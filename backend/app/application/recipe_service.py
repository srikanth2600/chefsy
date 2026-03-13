import json
import logging
import re
from typing import Any
from copy import deepcopy
from pydantic import ValidationError

from openai import OpenAI

logger = logging.getLogger(__name__)

from app.application.recipe_retriever import RecipeRetriever
from app.core.config import settings
from app.core.db import get_connection
from app.domain.recipe import Recipe

# Only reuse cached recipe if semantic similarity is very strong.
# Prevents wrong reuse for different dietary intent.
SIMILARITY_THRESHOLD = 0.85

SUPPORTED_OLLAMA_MODELS = {
    "llama3.1:latest",
    "llama3:latest",
}

retriever = RecipeRetriever()


def _load_recipe_from_db(recipe_id: int):
    """
    Load structured recipe + ingredients from existing SQL tables.
    Used when we get a semantic match from the vector layer.
    """
    with get_connection() as conn:
        cur = conn.cursor()

        # Load recipe core
        cur.execute(
            "SELECT title, steps_json, servings FROM recipe_master WHERE id = %s",
            (recipe_id,),
        )
        row = cur.fetchone()

        if not row:
            return None

        # Load ingredients
        cur.execute(
            """
            SELECT im.name, rim.quantity, rim.unit
            FROM recipe_ingredient_map rim
            JOIN ingredient_master im ON im.id = rim.ingredient_id
            WHERE rim.recipe_id = %s
            """,
            (recipe_id,),
        )
        ingredients = cur.fetchall()

        return {
            "title": row["title"],
            "steps": row["steps_json"],
            "servings": row["servings"],
            "ingredients": [
                {"name": i["name"], "quantity": i["quantity"], "unit": i["unit"]}
                for i in ingredients
            ],
        }


def _make_system_prompt() -> str:
    return """You are an expert chef and nutrition assistant.

CRITICAL OUTPUT RULES:
1. Return ONLY valid JSON — no markdown, no code fences, no explanations.
2. Output must be directly parseable by Python json.loads().
3. NEVER nest "ingredients" inside another "ingredients" key.
4. ingredients must be a FLAT array at the top level of each recipe object.

MULTIPLE RECIPES RULE:
- If the user asks for more than one dish (e.g. "idli and dosa", "breakfast combo"), return a JSON object with a "recipes" array containing one complete object per dish.
- If only one dish is requested, return a single recipe object directly (no "recipes" wrapper).

SINGLE RECIPE FORMAT:
{
  "title": "Masala Dosa",
  "description": "A crispy South Indian crepe filled with spiced potato stuffing, served with coconut chutney and sambar.",
  "servings": 4,
  "meta": {
    "cuisine": "South Indian",
    "difficulty": "Moderate",
    "estimated_time": "45 minutes"
  },
  "ingredients": [
    {"name": "Rice", "quantity": "2 cups"},
    {"name": "Urad dal", "quantity": "1/2 cup"}
  ],
  "steps": [
    "Soak rice and urad dal for 6 hours then grind to a smooth batter.",
    "Ferment the batter overnight at room temperature.",
    "Heat a non-stick pan pour a ladle of batter and spread thin.",
    "Cook until golden and crispy fold and serve hot."
  ],
  "tips": [
    "Fermentation is key — batter must be slightly sour for best flavour.",
    "Use a cast iron pan for the crispiest dosa."
  ],
  "nutrition": {
    "calories": "220 per serving",
    "protein": "6g",
    "carbs": "42g",
    "fat": "3g"
  },
  "tags": ["south-indian", "vegetarian", "breakfast"],
  "ai_context": {
    "user_intent": "User requested masala dosa",
    "health_goal": "balanced meal",
    "diet_type": "vegetarian",
    "cooking_style": "traditional"
  }
}

MULTIPLE RECIPES FORMAT (use when user asks for 2+ dishes):
{
  "recipes": [
    { ...complete recipe object for dish 1... },
    { ...complete recipe object for dish 2... }
  ]
}

FIELD RULES:
- description: 1-2 sentence summary of the dish. Always include.
- difficulty: MUST be exactly one of: "Easy" / "Moderate" / "Hard" / "Expert" based on real skill required.
- estimated_time: realistic total time including prep e.g. "20 minutes" or "1 hour 30 minutes".
- tips: array of 1-3 short practical cooking tips. Always include at least one tip.
- ingredients: each entry is ONLY {"name": "...", "quantity": "..."}. Never add other keys.
- steps: clear actions as plain strings. Each step should be one action.
- nutrition: per serving estimates for calories protein carbs fat.

Return JSON only. No other text before or after the JSON."""


# ═══════════════════════════════════════════════════════════════════════════
# LAYER 1 — EXTRACTION
# Gets raw JSON string out of any LLM wrapper format.
# Handles: markdown fences, text preamble, truncated output, single quotes.
# ═══════════════════════════════════════════════════════════════════════════

def _extract_json(text: str) -> str:
    """
    Extract first JSON object from LLM output regardless of wrapper format.
    Handles:
    - Markdown code fences: ```json ... ``` or ``` ... ```
    - Text preamble: "Here is your recipe: {...}"
    - Truncated output: finds last } as fallback
    - Stray { inside string values (Ollama corruption)
    """
    # Strip markdown code fences (GPT-4o, Claude, Gemini often wrap in these)
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)

    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in LLM output: {text[:200]}")

    # Primary: balanced brace counting (respects string boundaries)
    depth = 0
    in_string = False
    escape = False
    quote = None
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\" and in_string:
            escape = True
            continue
        if not in_string:
            if c in ('"', "'"):
                in_string = True
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start: i + 1]
        else:
            if c == quote:
                in_string = False

    # Fallback: brace counting failed (corrupt string contained stray {)
    # Use last } in text as closing brace
    logger.warning("_extract_json: brace counting failed, using last-} fallback")
    last_brace = text.rfind("}")
    if last_brace == -1:
        raise ValueError(f"No closing brace found in LLM output: {text[:200]}")
    return text[start: last_brace + 1]


# ═══════════════════════════════════════════════════════════════════════════
# LAYER 2 — NORMALIZATION
# Repairs structural JSON corruption before parsing.
# Each LLM has its own failure modes — we handle them all here.
# ═══════════════════════════════════════════════════════════════════════════

def _clean_json_for_parse(raw: str) -> str:
    """
    Repair structural JSON corruption from any LLM before json.loads.

    LLM-specific patterns handled:
    - Ollama:   "estimated_time "Moderate",  → corrupt key (no colon), drop line
    - Ollama:   "cuisine": "Indian {         → stray { in string value, strip it
    - All:      trailing commas before } or ]
    - All:      'single quoted values'       → "double quoted"
    - All:      nested ingredients collision
    - Gemma/Mistral: {unquoted_key: "value"} → {"unquoted_key": "value"}
    """
    # Line-by-line repair
    cleaned = []
    for line in raw.splitlines():
        stripped = line.strip()

        # Ollama corrupt fragment: "key_name "value",  (no colon between key and value)
        # Real lines always have:  "key": "value",
        # Detection: quoted segment before value has no colon — key bleeds into value
        if re.match(r'^"[\w_\s]+\s"', stripped) and ":" not in stripped.split('"')[1]:
            continue  # drop corrupt fragment, real duplicate line follows

        # Ollama stray { at end of string value: "cuisine": "Indian {
        line = re.sub(
            r'("[\w_]+":\s*"[^"]*?)\s*\{\s*$',
            lambda m: m.group(1) + '"',
            line
        )

        cleaned.append(line)

    raw = "\n".join(cleaned)

    # Global fixes applicable to all LLMs
    raw = re.sub(r",\s*}", "}", raw)                                          # trailing commas
    raw = re.sub(r",\s*]", "]", raw)                                          # trailing commas in arrays
    raw = re.sub(r'"name"\s*:\s*"ingredients"\s*:\s*\[', '"ingredients": [', raw)  # nested key collision
    raw = re.sub(r":\s*'([^']*)'", r': "\1"', raw)                           # single → double quotes
    raw = re.sub(r'{\s*([a-zA-Z_]\w*)\s*:', r'{ "\1":', raw)                 # unquoted first key (Gemma)
    raw = re.sub(r',\s*([a-zA-Z_]\w*)\s*:', r', "\1":', raw)                 # unquoted subsequent keys

    return raw


# ═══════════════════════════════════════════════════════════════════════════
# LAYER 3 — FIELD MAPPING
# Maps any LLM's field names → your canonical schema.
# This is what makes the system LLM-agnostic.
# Add new aliases here when you add a new LLM provider.
# ═══════════════════════════════════════════════════════════════════════════

# Canonical field → list of aliases used by different LLMs
_FIELD_ALIASES: dict[str, list[str]] = {
    # Top-level
    "title":       ["title", "name", "recipe_name", "dish", "dish_name"],
    "description": ["description", "summary", "overview", "about", "intro"],
    "servings":    ["servings", "serves", "yield", "portions", "people"],
    "steps":       ["steps", "instructions", "directions", "method", "procedure", "steps_json"],
    "ingredients": ["ingredients", "items", "ingredient_list"],
    "tips":        ["tips", "tip", "chef_tips", "notes", "cooking_notes", "hints"],
    "tags":        ["tags", "keywords", "labels", "categories"],
    # Meta sub-fields
    "cuisine":          ["cuisine", "cuisine_type", "food_type", "origin", "regional"],
    "difficulty":       ["difficulty", "difficulty_level", "skill_level", "level", "complexity"],
    "estimated_time":   ["estimated_time", "cook_time", "cooking_time", "total_time",
                         "prep_time", "time", "duration", "time_required"],
    # Nutrition sub-fields
    "calories": ["calories", "kcal", "energy", "cal"],
    "protein":  ["protein", "proteins", "protein_g"],
    "carbs":    ["carbs", "carbohydrates", "carb", "carbs_g"],
    "fat":      ["fat", "fats", "total_fat", "fat_g"],
    "fiber":    ["fiber", "fibre", "dietary_fiber"],
}

_DIFFICULTY_MAP = {
    "easy": "Easy", "simple": "Easy", "beginner": "Easy", "basic": "Easy",
    "medium": "Moderate", "moderate": "Moderate", "intermediate": "Moderate", "average": "Moderate",
    "hard": "Hard", "difficult": "Hard", "advanced": "Hard", "challenging": "Hard",
    "expert": "Expert", "complex": "Expert", "professional": "Expert", "master": "Expert",
}


def _resolve(d: dict, canonical: str) -> Any:
    """Return value for canonical field checking all known aliases. Returns None if not found."""
    for alias in _FIELD_ALIASES.get(canonical, [canonical]):
        if alias in d and d[alias] not in (None, "", [], {}):
            return d[alias]
    return None


def _coerce_single_recipe(data: dict[str, Any]) -> dict[str, Any]:
    """
    Map any LLM's response dict → canonical recipe schema.
    Works with GPT-4o, Claude, Llama, Mistral, Gemma, Llava, or any future LLM.
    """
    d = deepcopy(data)

    # ── title ─────────────────────────────────────────────────────────────────
    title = _resolve(d, "title") or "Untitled Recipe"

    # ── description ───────────────────────────────────────────────────────────
    description = _resolve(d, "description") or ""

    # ── servings ──────────────────────────────────────────────────────────────
    serv_raw = _resolve(d, "servings")
    if isinstance(serv_raw, str):
        m_range = re.search(r"(\d+)\s*[-–]\s*(\d+)", serv_raw)
        if m_range:
            servings = max(1, (int(m_range.group(1)) + int(m_range.group(2))) // 2)
        else:
            m = re.search(r"(\d+)", serv_raw)
            servings = int(m.group(1)) if m else 2
    elif isinstance(serv_raw, int) and serv_raw > 0:
        servings = serv_raw
    else:
        servings = 2

    # ── meta: handle both flat and nested formats ─────────────────────────────
    # Some LLMs return flat: {"cuisine": "Indian", "difficulty": "Easy"}
    # Others return nested: {"meta": {"cuisine": "Indian", "difficulty": "Easy"}}
    meta_raw = d.get("meta") or {}
    if not isinstance(meta_raw, dict):
        meta_raw = {}

    cuisine   = _resolve(meta_raw, "cuisine")   or _resolve(d, "cuisine")   or ""
    diff_raw  = _resolve(meta_raw, "difficulty") or _resolve(d, "difficulty") or ""
    time_val  = _resolve(meta_raw, "estimated_time") or _resolve(d, "estimated_time") or ""

    # Normalise difficulty to canonical value
    difficulty = _DIFFICULTY_MAP.get(str(diff_raw).strip().lower(), "")
    if not difficulty and diff_raw:
        difficulty = "Moderate"  # safe default for unrecognised values

    meta = {
        "cuisine":        cuisine,
        "difficulty":     difficulty,
        "estimated_time": time_val,
    }

    # ── steps ─────────────────────────────────────────────────────────────────
    def _strip_md(s: str) -> str:
        # Remove common markdown emphasis wrappers
        return re.sub(r"(^\*+|\*+$|^_+|_+$)", "", s).strip()

    def _parse_step_text(text: str) -> dict[str, str]:
        t = text.strip()
        # Remove leading bullets / numbering
        t = re.sub(r"^[\-\*\d\.\)\s]+", "", t).strip()
        if not t:
            return {}
        # **Title**: description
        m = re.match(r"^\*\*(.+?)\*\*\s*:\s*(.+)$", t)
        if m:
            return {"title": _strip_md(m.group(1)), "description": m.group(2).strip()}
        # Title: description
        m = re.match(r"^([^:]{2,60})\s*:\s*(.+)$", t)
        if m:
            return {"title": _strip_md(m.group(1)), "description": m.group(2).strip()}
        return {"description": t}

    steps_raw = _resolve(d, "steps") or []
    if isinstance(steps_raw, str):
        parts = [s.strip() for s in re.split(r"[\n\r]+|(?<=[.!?])\s+(?=[A-Z])", steps_raw) if s.strip()]
        steps = [st for st in (_parse_step_text(p) for p in parts) if st]
    elif isinstance(steps_raw, list):
        steps = []
        for s in steps_raw:
            if isinstance(s, str):
                parsed = _parse_step_text(s)
                if parsed:
                    steps.append(parsed)
            elif isinstance(s, dict):
                # Preserve explicit title/description when provided
                title = s.get("title")
                desc = s.get("description")
                if title or desc:
                    steps.append({"title": str(title) if title else "", "description": str(desc) if desc else ""})
                    continue
                # Claude/GPT sometimes return {"step": 1, "instruction": "..."} etc.
                text = (s.get("instruction") or s.get("text") or s.get("step") or s.get("action") or "")
                if text:
                    parsed = _parse_step_text(str(text))
                    if parsed:
                        steps.append(parsed)
    else:
        steps = []

    # ── ingredients ───────────────────────────────────────────────────────────
    def _normalize_fractions(s: str) -> str:
        # Replace common unicode fractions with ascii equivalents
        frac_map = {
            "½": "1/2",
            "¼": "1/4",
            "¾": "3/4",
            "⅓": "1/3",
            "⅔": "2/3",
            "⅛": "1/8",
            "⅜": "3/8",
            "⅝": "5/8",
            "⅞": "7/8",
        }
        out = s
        for k, v in frac_map.items():
            # handle cases like "1½" => "1 1/2"
            out = re.sub(rf"(\\d){re.escape(k)}", rf"\\1 {v}", out)
            out = out.replace(k, v)
        return out
    ing_raw = _resolve(d, "ingredients") or []
    if isinstance(ing_raw, str):
        items = [s.strip() for s in re.split(r"[\n\r]+", ing_raw) if s.strip()]
        ingredients = []
        for it in items:
            it = _normalize_fractions(it)
            m = re.match(r"^(\d+[\d\s\/\.-]*)(.*)$", it)
            if m:
                ingredients.append({"name": m.group(2).strip() or it, "quantity": m.group(1).strip()})
            else:
                ingredients.append({"name": it, "quantity": ""})
    elif isinstance(ing_raw, list):
        ingredients = []
        for it in ing_raw:
            if isinstance(it, str):
                ingredients.append({"name": it, "quantity": ""})
            elif isinstance(it, dict):
                # Handle all alias variants for name and quantity
                name = (it.get("name") or it.get("ingredient") or it.get("item") or
                        it.get("ingredient_name") or "")
                qty  = str(it.get("quantity") or it.get("qty") or it.get("amount") or
                           it.get("measure") or "")
                qty = _normalize_fractions(qty)
                if name:
                    ingredients.append({"name": name, "quantity": qty})
    else:
        ingredients = []

    # ── tips ──────────────────────────────────────────────────────────────────
    tips_raw = _resolve(d, "tips") or []
    if isinstance(tips_raw, str):
        tips = [t.strip() for t in tips_raw.split("\n") if t.strip()]
    elif isinstance(tips_raw, list):
        tips = [str(t) for t in tips_raw if t]
    else:
        tips = []

    # ── nutrition: handle flat or nested ─────────────────────────────────────
    # Some LLMs: {"nutrition": {"calories": "400 kcal", "protein": "20g"}}
    # Others:    {"calories": "400", "protein": "20g"}  (flat at top level)
    nutr_raw = d.get("nutrition") or {}
    if not isinstance(nutr_raw, dict):
        nutr_raw = {}
    nutrition = {}
    for canon in ("calories", "protein", "carbs", "fat", "fiber"):
        val = _resolve(nutr_raw, canon) or _resolve(d, canon)
        if val:
            nutrition[canon] = str(val)

    # ── tags ──────────────────────────────────────────────────────────────────
    tags_raw = _resolve(d, "tags") or []
    if isinstance(tags_raw, str):
        tags = [t.strip() for t in re.split(r"[,\n]", tags_raw) if t.strip()]
    elif isinstance(tags_raw, list):
        tags = [str(t) for t in tags_raw if t]
    else:
        tags = []

    # ── ai_context: preserve whatever the LLM sent ───────────────────────────
    ai_context = d.get("ai_context") or {}
    if not isinstance(ai_context, dict):
        ai_context = {}

    return {
        "title":       title,
        "description": description,
        "servings":    servings,
        "meta":        meta,
        "ingredients": ingredients,
        "steps":       steps,
        "tips":        tips,
        "nutrition":   nutrition,
        "tags":        tags,
        "ai_context":  ai_context,
    }




def _validate_and_coerce(data: dict[str, Any]) -> dict[str, Any]:
    """
    Entry point for validation. Handles both single recipe and multi-recipe
    {"recipes": [...]} response from LLM.

    For multi-recipe: coerces each sub-recipe and stores them under "recipes" key.
    For single recipe: coerces and validates against Recipe model.
    """
    # ── Multi-recipe response ─────────────────────────────────────────────────
    if "recipes" in data and isinstance(data["recipes"], list):
        coerced_recipes = []
        for r in data["recipes"]:
            if isinstance(r, dict):
                try:
                    coerced_recipes.append(_coerce_single_recipe(r))
                except Exception:
                    logger.exception("_validate_and_coerce: failed to coerce sub-recipe: %s", r.get("title"))
        if not coerced_recipes:
            raise RuntimeError("Multi-recipe response had no valid recipes")
        # Return envelope — first recipe is the "primary" for DB schema compat
        primary = coerced_recipes[0]
        primary["recipes"] = coerced_recipes  # embed full list for frontend
        return primary

    # ── Single recipe ─────────────────────────────────────────────────────────
    d = _coerce_single_recipe(data)
    try:
        recipe = Recipe.model_validate(d)
        out = recipe.model_dump()
        # Re-attach new fields not in Pydantic model yet
        for extra in ("description", "tips", "meta", "nutrition", "tags", "ai_context"):
            if extra not in out and extra in d:
                out[extra] = d[extra]
            elif extra in d and out.get(extra) is None:
                out[extra] = d[extra]
        return out
    except ValidationError:
        # Pydantic model may not have new fields yet — return coerced dict directly
        logger.warning("_validate_and_coerce: Pydantic validation failed, returning coerced dict for title=%r", d.get("title"))
        return d


def _extract_intent_keywords(query: str) -> set[str]:
    query = query.lower()

    keywords = {
        "high_protein": ["high protein", "protein rich", "gym", "muscle"],
        "low_carb": ["low carb", "keto"],
        "weight_loss": ["weight loss", "diet", "low calorie"],
        "vegan": ["vegan", "no dairy"],
        "quick": ["quick", "fast", "5 minute"],
    }

    found = set()

    for label, variants in keywords.items():
        if any(v in query for v in variants):
            found.add(label)

    return found


def _mock_generate(title: str) -> dict[str, Any]:
    """Simple deterministic mock recipe used as an alternative provider for testing/demo."""
    return {
        "title": f"{title} (mock)",
        "servings": 2,
        "steps": [
            "Prepare ingredients.",
            "Cook with care.",
            "Serve hot."
        ],
        "ingredients": [
            {"name": "ingredient", "quantity": "1", "unit": "pcs"}
        ],
    }


def generate_recipe(title: str, provider: str | None = None) -> dict[str, Any]:
    """
    Application use-case for generating a recipe via LLM and validating it against domain models.
    """
    provider = (provider or settings.default_llm_provider).lower()

    # ----------------------------------------
    # LEVEL 2 CACHE — Semantic Vector Retrieval
    # ----------------------------------------
    try:
        vector_hits = retriever.search_similar(title, limit=1)

        if not vector_hits:
            pass  # No hits — continue to LLM
        else:
            hit = vector_hits[0]
            score = None
            payload = {}

            if isinstance(hit, (list, tuple)) and len(hit) >= 3:
                _, score, payload = hit[0], hit[1], hit[2]
                payload = payload or {}
            else:
                score = getattr(hit, "score", None)
                payload = getattr(hit, "payload", {}) or {}

            logger.info("[VECTOR] score=%s threshold=%s", score, SIMILARITY_THRESHOLD)
            if score is None or score < SIMILARITY_THRESHOLD:
                pass  # Too different — must generate new recipe; skip cache and continue to LLM
            else:
                recipe_id = payload.get("recipe_id")
            if recipe_id:
                cached_recipe = _load_recipe_from_db(int(recipe_id))
                if cached_recipe:
                    # Verify intent tags (preserve existing behaviour)
                    query_intent = _extract_intent_keywords(title)
                    cached_intent = set()
                    if isinstance(payload, dict):
                        cached_intent = set(payload.get("intent_tags", []))
                    if query_intent and query_intent != cached_intent:
                        pass  # Different cooking goal — do NOT reuse; skip cache and continue to LLM
                    else:
                        # Additional safety: ensure the cached recipe is actually about the same dish.
                        # Token-match significant words (ignore very generic terms like 'vegetable').
                        def _tokens(s: str) -> set[str]:
                            return set(re.findall(r"\w+", (s or "").lower()))

                        STOPWORDS = {
                            "vegetable", "mixed", "fresh", "easy", "quick", "recipe",
                            "recipes", "classic", "indian", "asian", "dish",
                        }

                        q_tokens = _tokens(title) - STOPWORDS
                        title_tokens = _tokens(cached_recipe.get("title") or "")
                        ing_tokens = set()
                        for ing in (cached_recipe.get("ingredients") or []):
                            if isinstance(ing, dict):
                                ing_tokens.update(_tokens(ing.get("name") or ""))
                            else:
                                ing_tokens.update(_tokens(str(ing)))

                        significant_match = False
                        if q_tokens:
                            if q_tokens & title_tokens:
                                significant_match = True
                            elif q_tokens & ing_tokens:
                                significant_match = True
                        else:
                            # If no significant tokens (e.g., user just said 'veg'), fall back to vector hit
                            significant_match = True

                        if not significant_match:
                            logger.info(
                                "[VECTOR] cached recipe '%s' skipped due to token mismatch for query '%s'",
                                cached_recipe.get("title"), title,
                            )
                            pass
                        else:
                            return cached_recipe
    except Exception:
        # Vector errors must NEVER break recipe generation
        pass
    # ----------------------------------------

    if provider == "mock":
        recipe = _mock_generate(title)
        # validate via domain model (coerce if needed)
        return _validate_and_coerce(recipe)

    if provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is missing.")

        client = OpenAI(api_key=settings.openai_api_key)
        system_prompt = _make_system_prompt()
        user_prompt = f"Create a recipe for: {title}"

        def _request(extra_note: str | None = None) -> dict[str, Any]:
            prompt = user_prompt if not extra_note else f"{user_prompt}\n{extra_note}"
            response = client.responses.create(
                model=settings.openai_model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.output_text
            try:
                data = json.loads(text)
            except Exception as exc:
                logger.exception("[RECIPE] OpenAI returned invalid JSON. Raw output snippet: %s", (text or "")[:2000])
                raise RuntimeError(f"OpenAI returned invalid JSON: {exc}. Raw output (truncated): {(text or '')[:1000]}") from exc
            # Ensure new optional fields exist so old recipes still work
            data.setdefault("meta", None)
            data.setdefault("nutrition", None)
            data.setdefault("tags", None)
            data.setdefault("ai_context", {})
            if isinstance(data.get("ai_context"), dict):
                data["ai_context"].setdefault("raw_llm_text", (text or "")[:4000])
            # validate via domain model with coercion/cleanup
            try:
                return _validate_and_coerce(data)
            except ValidationError as ve:
                logger.exception("[RECIPE] Validation failed for OpenAI response. Raw output snippet: %s", (text or "")[:2000])
                raise ve

        try:
            return _request()
        except Exception:
            retry_note = "Your previous response was invalid. Return ONLY valid JSON and nothing else."
            try:
                return _request(retry_note)
            except Exception as exc:
                raise RuntimeError(f"Invalid recipe JSON: {exc}") from exc
    if provider.startswith("groq"):
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is missing.")
        parts = provider.split(":", 1)
        model = parts[1] if len(parts) > 1 and parts[1] else settings.groq_model
        client = OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)
        system_prompt = _make_system_prompt()
        user_prompt = f"Create a recipe for: {title}"

        def _request(extra_note: str | None = None) -> dict[str, Any]:
            prompt = user_prompt if not extra_note else f"{user_prompt}\n{extra_note}"
            response = client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            text = response.output_text
            try:
                data = json.loads(text)
            except Exception as exc:
                logger.exception("[RECIPE] Groq returned invalid JSON. Raw output snippet: %s", (text or "")[:2000])
                raise RuntimeError(f"Groq returned invalid JSON: {exc}. Raw output (truncated): {(text or '')[:1000]}") from exc
            data.setdefault("meta", None)
            data.setdefault("nutrition", None)
            data.setdefault("tags", None)
            data.setdefault("ai_context", {})
            if isinstance(data.get("ai_context"), dict):
                data["ai_context"].setdefault("raw_llm_text", (text or "")[:4000])
            try:
                return _validate_and_coerce(data)
            except ValidationError as ve:
                logger.exception("[RECIPE] Validation failed for Groq response. Raw output snippet: %s", (text or "")[:2000])
                raise ve

        try:
            return _request()
        except Exception:
            retry_note = "Your previous response was invalid. Return ONLY valid JSON and nothing else."
            try:
                return _request(retry_note)
            except Exception as exc:
                raise RuntimeError(f"Invalid recipe JSON: {exc}") from exc
    # Support ollama provider. provider may be "ollama" or "ollama:modelname"
    if provider.startswith("ollama"):
        # extract model if provided
        parts = provider.split(":", 1)
        model = parts[1] if len(parts) > 1 and parts[1] else settings.default_ollama_model
        system_prompt = _make_system_prompt()
        user_prompt = f"Create a recipe for: {title}"
        prompt = f"{system_prompt}\n{user_prompt}"

        # Try Python ollama client first, then fallback to subprocess CLI
        try:
            import ollama  # type: ignore

            try:
                client = ollama.Ollama()  # type: ignore
                # client.generate may differ by SDK; attempt common patterns
                if hasattr(client, "generate"):
                    out = client.generate(model=model, prompt=prompt)
                    # ollama-python GenerateResponse uses .response; older clients may use .text
                    text = out if isinstance(out, str) else (getattr(out, "response", None) or getattr(out, "text", None) or str(out))
                elif hasattr(client, "create"):
                    out = client.create(model=model, prompt=prompt)
                    text = out if isinstance(out, str) else (getattr(out, "response", None) or getattr(out, "text", None) or str(out))
                else:
                    raise RuntimeError("Unsupported ollama python client API")
            except Exception:
                # last-resort: call CLI
                raise
        except Exception:
            # Fallback to calling the ollama CLI
            from subprocess import run, CalledProcessError

            try:
                proc = run(
                    ["ollama", "run", model, prompt, "--format", "json"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=True,
                )
                text = proc.stdout.strip()
            except CalledProcessError as exc:
                raise RuntimeError(f"Ollama run failed: {exc.stderr}") from exc

        print("OLLAMA RAW OUTPUT:", (text or "")[:500])
        # parse JSON and validate (with coercion/retry)
        try:
            clean_json = _extract_json(text)
            clean_json = _clean_json_for_parse(clean_json)
            try:
                data = json.loads(clean_json)
            except Exception as exc:
                logger.exception("[RECIPE] Ollama returned invalid JSON after extraction. Raw output snippet: %s", (text or "")[:2000])
                raise RuntimeError(f"Ollama returned invalid JSON: {exc}. Raw output (truncated): {(text or '')[:1000]}") from exc
            data.setdefault("meta", None)
            data.setdefault("nutrition", None)
            data.setdefault("tags", None)
            data.setdefault("ai_context", {})
            try:
                return _validate_and_coerce(data)
            except ValidationError as ve:
                logger.exception("[RECIPE] Validation failed for Ollama response. Cleaned JSON snippet: %s", (clean_json or "")[:2000])
                raise ve
        except Exception as exc:
            # Attempt one more relaxed retry: try to salvage by cleaning text aggressively
            try:
                salvaged = _clean_json_for_parse(_extract_json(text))
                try:
                    data2 = json.loads(salvaged)
                except Exception as exc2:
                    logger.exception("[RECIPE] Ollama salvage attempt failed to parse JSON. Salvaged snippet: %s", (salvaged or "")[:2000])
                    raise RuntimeError(f"Invalid recipe JSON from ollama: {exc2}. Salvaged (truncated): {(salvaged or '')[:1000]}") from exc2
                data2.setdefault("meta", None)
                data2.setdefault("nutrition", None)
                data2.setdefault("tags", None)
                data2.setdefault("ai_context", {})
                try:
                    return _validate_and_coerce(data2)
                except ValidationError as ve2:
                    logger.exception("[RECIPE] Validation failed for Ollama salvaged JSON. Salvaged snippet: %s", (salvaged or "")[:2000])
                    raise ve2
            except Exception as exc2:
                logger.exception("[RECIPE] Ollama final salvage attempt failed. Raw output snippet: %s", (text or "")[:2000])
                raise RuntimeError(f"Invalid recipe JSON from ollama: {exc2}. Raw output (truncated): {(text or '')[:1000]}") from exc2

    raise RuntimeError(f"Unknown recipe generation provider: {provider}")

