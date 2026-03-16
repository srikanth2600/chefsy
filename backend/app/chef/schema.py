from pydantic import BaseModel, field_validator
from typing import Optional
import re


class ChefProfileCreate(BaseModel):
    slug: str
    designation: Optional[str] = None
    cuisine_speciality: Optional[str] = None
    cuisine_tags: list[str] = []
    experience_years: Optional[int] = None
    location: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$", v):
            raise ValueError("Slug must be 3–50 chars: lowercase letters, numbers, hyphens only (no leading/trailing hyphen)")
        return v


class ChefProfileUpdate(BaseModel):
    designation: Optional[str] = None
    cuisine_speciality: Optional[str] = None
    cuisine_tags: Optional[list[str]] = None
    experience_years: Optional[int] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    certifications: Optional[list[str]] = None
    avatar_color: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    youtube_url: Optional[str] = None
    instagram_url: Optional[str] = None
    website_url: Optional[str] = None
    appearance_theme: Optional[dict] = None
    gender: Optional[str] = None
    # Address fields
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ChefPublicOut(BaseModel):
    id: int
    user_id: int
    slug: str
    name: str
    designation: Optional[str]
    cuisine_speciality: Optional[str]
    cuisine_tags: list
    experience_years: Optional[int]
    location: Optional[str]
    bio: Optional[str]
    avatar_color: str
    avatar_url: Optional[str]
    banner_url: Optional[str]
    youtube_url: Optional[str]
    instagram_url: Optional[str]
    website_url: Optional[str]
    appearance_theme: Optional[dict]
    plan: str
    is_verified: bool
    is_featured: bool
    is_active: bool
    rating: Optional[float]
    review_count: int
    follower_count: int
    recipe_count: int
    profile_views: int
    created_at: str


class ChefListItem(BaseModel):
    id: int
    slug: str
    name: str
    designation: Optional[str]
    cuisine_speciality: Optional[str]
    location: Optional[str]
    avatar_color: str
    avatar_url: Optional[str]
    is_verified: bool
    is_featured: bool
    plan: str
    rating: Optional[float]
    review_count: int
    recipe_count: int


class ChefFollowOut(BaseModel):
    following: bool
    follower_count: int


class ChefReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ChefReviewOut(BaseModel):
    id: int
    chef_id: int
    user_id: int
    reviewer_name: str
    rating: int
    comment: Optional[str]
    created_at: str


class ChefAnalyticsOut(BaseModel):
    profile_views: int
    total_recipe_views: int
    total_likes: int
    total_recipes: int
    total_videos: int = 0
    total_reels: int = 0
    follower_count: int
    review_count: int
    rating: Optional[float]


class ChefPlanUsageOut(BaseModel):
    plan: str
    recipes_used: int
    recipes_limit: int
    videos_used: int
    videos_limit: int
    can_add_recipe: bool
    can_add_video: bool


# ─── Chef Roles ───────────────────────────────────────────────────────────────

class ChefRoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ChefRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ChefRoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: str


class ChefRoleAssign(BaseModel):
    role_ids: list[int]


# ─── Categories ───────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    slug: str
    parent_id: Optional[int] = None

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$", v):
            raise ValueError("Slug must be lowercase letters, numbers, and hyphens only")
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: Optional[int]
    level: int
    created_at: str


class RecipeCategoryAssign(BaseModel):
    category_ids: list[int]


# ─── Chef Reels ───────────────────────────────────────────────────────────────

class ReelCreate(BaseModel):
    title: str
    description: Optional[str] = None
    hashtags: list[str] = []
    video_url: Optional[str] = None


class ReelUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[list[str]] = None
    video_url: Optional[str] = None
    status: Optional[str] = None


class ReelOut(BaseModel):
    id: int
    chef_id: int
    title: str
    description: Optional[str]
    hashtags: list
    video_url: Optional[str]
    video_file_path: Optional[str]
    platform: Optional[str]
    thumbnail: Optional[str]
    status: str
    view_count: int
    created_at: str


# ─── Chef Recipes (chef-authored) ─────────────────────────────────────────────

class IngredientIn(BaseModel):
    name: str
    quantity: str = ""
    unit: str = "g"


class RecipeSave(BaseModel):
    id: Optional[int] = None          # set when updating an existing recipe
    title: str
    cuisine: Optional[str] = ""
    difficulty: Optional[str] = "Moderate"
    cook_time: Optional[str] = ""
    servings: Optional[int] = 4
    description: Optional[str] = ""
    tips: Optional[str] = ""
    video_url: Optional[str] = ""
    image_url: Optional[str] = None
    ingredients: list[IngredientIn] = []
    steps: list[str] = []
    calories: Optional[str] = None
    protein: Optional[str] = None
    carbs: Optional[str] = None
    fat: Optional[str] = None
    is_published: bool = False
