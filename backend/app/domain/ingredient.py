import re
from typing import Dict


_ALIASES: Dict[str, str] = {
    "tomatoes": "tomato",
    "potatoes": "potato",
    "chilies": "chili",
    "chillies": "chili",
    "chilli": "chili",
    "capsicum": "bell-pepper",
    "bell": "bell-pepper",
    "coriander": "cilantro",
    "dhaniya": "cilantro",
    "ginger-garlic": "ginger-garlic-paste",
}


def normalize_ingredient_name(name: str) -> str:
    """
    Normalize an ingredient name into a canonical kebab-case key suitable for
    lookup and storage. Examples:
      "Tomatoes (ripe)" -> "tomato"
      "Fresh ginger-garlic" -> "ginger-garlic-paste"
    """
    cleaned = (name or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9\s\-]", "", cleaned)
    tokens = re.split(r"\s+", cleaned)
    normalized = []
    for token in tokens:
        if not token:
            continue
        token = _ALIASES.get(token, token)
        if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        normalized.append(token)
    cleaned = "-".join(normalized)
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned or "ingredient"


def normalize_ingredient_alias_key(name: str) -> str:
    """
    Create a stable alias key used for deduplication and alias table storage.
    """
    cleaned = (name or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9\s\-]", "", cleaned)
    cleaned = re.sub(r"\s+", "-", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned or "ingredient"

