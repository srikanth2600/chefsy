from typing import Any, Optional
from pydantic import BaseModel


class MealPlanCreate(BaseModel):
    name: str = "My Meal Plan"
    description: Optional[str] = None
    week_start_date: Optional[str] = None
    servings: int = 2
    preferences_json: Optional[dict] = None


class MealPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    week_start_date: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'archived'


class MealPlanGenerateRequest(BaseModel):
    name: Optional[str] = None
    dietary_preferences: list[str] = []
    allergies: list[str] = []
    servings: int = 2
    cuisine_preference: Optional[str] = None
    meal_types: list[str] = ["breakfast", "lunch", "dinner"]
    extra_context: Optional[str] = None
    body_lifestyle: Optional[dict] = None
    llm_provider: Optional[str] = None  # provider_id from /providers endpoint e.g. "groq:llama-3.1-8b-instant"
    week_start_date: Optional[str] = None  # ISO date string, e.g. "2026-03-25"


class SlotUpdate(BaseModel):
    recipe_id: Optional[int] = None
    meal_name: Optional[str] = None
    meal_json: Optional[dict[str, Any]] = None


class MealPlanSlotOut(BaseModel):
    id: int
    meal_plan_id: int
    day_index: int
    meal_type: str
    recipe_id: Optional[int]
    meal_name: Optional[str]
    meal_json: Optional[dict[str, Any]]
    sort_order: int


class MealPlanOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    week_start_date: Optional[str]
    servings: int
    preferences_json: Optional[dict]
    status: str
    created_at: str
    slot_count: int = 0