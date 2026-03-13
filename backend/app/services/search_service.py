from typing import Optional, Dict, Any
import re
import logging

from app.core.db import get_connection
from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_query(q: str) -> str:
    if not q:
        return ""
    s = q.lower().strip()
    # remove common trailing words
    s = re.sub(r"\b(recipe|recipe for|how to make|how to)\b", " ", s)
    # replace non-alphanumeric with spaces
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s


def lookup_recipe_by_query(query: str) -> Optional[Dict[str, Any]]:
    """
    Try to find a recipe row (dict) by query using:
      1) exact slug match on recipe_key
      2) exact title match (case-insensitive)
      3) alias trigram match
      4) trigram similarity on title (pg_trgm)
      5) optional vector DB (Qdrant) - not implemented if not configured
    Returns the DB row (id,title,recipe_key,steps_json,recipe_json) or None.
    """
    qnorm = _normalize_query(query)
    slug = _slugify(qnorm)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1) exact recipe_key
                if slug:
                    cur.execute(
                        "SELECT id, recipe_key, title, steps_json, recipe_json FROM recipe_master WHERE recipe_key = %s LIMIT 1",
                        (slug,),
                    )
                    r = cur.fetchone()
                    if r:
                        return dict(r)

                # 2) exact title match
                cur.execute(
                    "SELECT id, recipe_key, title, steps_json, recipe_json FROM recipe_master WHERE LOWER(title) = LOWER(%s) LIMIT 1",
                    (query.strip(),),
                )
                r = cur.fetchone()
                if r:
                    return dict(r)

                # 3) alias trigram match (using % operator)
                try:
                    cur.execute(
                        "SELECT ra.recipe_id, rm.recipe_key, rm.title, rm.steps_json, rm.recipe_json "
                        "FROM recipe_aliases ra JOIN recipe_master rm ON rm.id = ra.recipe_id "
                        "WHERE ra.alias_text %% %s LIMIT 1",
                        (qnorm,),
                    )
                    r = cur.fetchone()
                    if r:
                        return dict({
                            "id": r["recipe_id"],
                            "recipe_key": r["recipe_key"],
                            "title": r["title"],
                            "steps_json": r["steps_json"],
                            "recipe_json": r["recipe_json"],
                        })
                except Exception:
                    # If pg_trgm not available or operator fails, continue
                    logger.exception("Alias trigram lookup failed")

                # 4) trigram similarity on title
                try:
                    cur.execute(
                        "SELECT id, recipe_key, title, steps_json, recipe_json, similarity(title, %s) AS sim "
                        "FROM recipe_master WHERE similarity(title, %s) > %s ORDER BY sim DESC LIMIT 1",
                        (query, query, getattr(settings, "trigram_threshold", 0.28)),
                    )
                    r = cur.fetchone()
                    if r:
                        return dict(r)
                except Exception:
                    logger.exception("Trigram similarity query failed")

                # 5) vector search placeholder (Qdrant) - only if configured; return None if not implemented
                # If you have Qdrant configured, integrate here (encode query -> search)
                if getattr(settings, "qdrant_url", None):
                    try:
                        # implement Qdrant lookup if desired
                        logger.info("Qdrant configured but vector lookup not implemented in search_service")
                    except Exception:
                        logger.exception("Qdrant lookup failed")

    except Exception:
        logger.exception("lookup_recipe_by_query failed")
    return None

