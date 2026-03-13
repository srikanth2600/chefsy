from pydantic import BaseModel
from typing import Optional


class VideoCreate(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    recipe_key: Optional[str] = None


class VideoOut(BaseModel):
    id: int
    url: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    recipe_key: Optional[str] = None

