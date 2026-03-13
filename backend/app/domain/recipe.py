from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str = Field(min_length=1)
    quantity: str = ""
    unit: str = ""


class Nutrition(BaseModel):
    calories: Optional[str] = None
    protein: Optional[str] = None
    carbs: Optional[str] = None
    fat: Optional[str] = None


class MetaInfo(BaseModel):
    estimated_time: Optional[str] = None
    difficulty: Optional[str] = None
    cuisine: Optional[str] = None


class Recipe(BaseModel):
    title: str = Field(min_length=1)
    servings: int = Field(ge=1, le=100)
    steps: List[str] = Field(min_length=1)
    ingredients: List[Dict[str, str]]

    # NEW (structured optional extensions)
    meta: Optional[MetaInfo] = None
    nutrition: Optional[Nutrition] = None
    tags: Optional[List[str]] = None

    # FLEXIBLE AI ZONE (this is the key addition)
    ai_context: Optional[Dict[str, Any]] = Field(default_factory=dict)
