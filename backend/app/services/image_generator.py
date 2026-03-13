import base64
import logging
import re
from pathlib import Path
from uuid import uuid4

from openai import OpenAI

from app.core.config import settings


logger = logging.getLogger(__name__)


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"[^a-z0-9\-]", "", value)
    return value or "ingredient"


def generate_ingredient_image(ingredient_name: str) -> str:
    # Image generation disabled — return placeholder image path.
    PLACEHOLDER_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    )
    media_root = Path(__file__).resolve().parents[3] / "media" / "ingredients"
    media_root.mkdir(parents=True, exist_ok=True)
    placeholder_path = media_root / "placeholder.png"
    if not placeholder_path.exists():
        try:
            placeholder_path.write_bytes(base64.b64decode(PLACEHOLDER_PNG_B64))
        except Exception:
            logger.exception("Failed to write ingredient placeholder image")
    logger.info("Image generation disabled — returning placeholder for ingredient: %s", ingredient_name)
    return f"/media/ingredients/{placeholder_path.name}"


def generate_recipe_image(recipe_title: str) -> str:
    # Image generation disabled — return placeholder recipe image path.
    PLACEHOLDER_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    )
    media_root = Path(__file__).resolve().parents[3] / "media" / "recipes"
    media_root.mkdir(parents=True, exist_ok=True)
    placeholder_path = media_root / "placeholder.png"
    if not placeholder_path.exists():
        try:
            placeholder_path.write_bytes(base64.b64decode(PLACEHOLDER_PNG_B64))
        except Exception:
            logger.exception("Failed to write recipe placeholder image")
    logger.info("Recipe image generation disabled — returning placeholder for recipe: %s", recipe_title)
    return f"/media/recipes/{placeholder_path.name}"
