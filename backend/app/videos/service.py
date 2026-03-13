from typing import Optional, Dict, List
from app.videos import repository


def create_video(user_id: int, url: str, title: Optional[str], description: Optional[str], recipe_id: Optional[int]) -> int:
    # Could add validation, thumbnail extraction, dedupe here
    return repository.create_video(user_id, url, title, description, recipe_id, status="approved")


def get_video(video_id: int) -> Optional[Dict]:
    v = repository.get_video_by_id(video_id)
    if not v:
        return None
    # compute thumbnail
    url = v.get("url") or ""
    vid = None
    import re

    m = re.search(r"[?&]v=([^&]+)", url)
    if m:
        vid = m.group(1)
    else:
        parts = url.rstrip("/").split("/")
        if parts:
            vid = parts[-1]
    thumb = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg" if vid else None
    v["thumbnail"] = thumb
    return v


def list_user_videos(user_id: int, limit: int = 3) -> List[Dict]:
    return repository.list_user_videos(user_id, limit)

