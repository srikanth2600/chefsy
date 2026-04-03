from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel

from app.api.routes import router as api_router
from app.api import auth as auth_module
from app.api import admin as admin_module
from app.videos import router as videos_router
from app.chef import router as chef_module
from app.meal_plan import router as meal_plan_module
from app.org import router as org_module
from app.org.corporate import router as corporate_module
from app.org.gym import router as gym_module
from app.org.nutrition import router as nutrition_module
from app.org.modules.meal_batch import router as meal_batch_module
from app.org.modules.custom_meal_planner import router as custom_meal_planner_module
from app.org.modules.compliance import router as compliance_module
from app.org.modules.content import router as content_module
from app.org.modules.challenges import router as challenges_module
from app.org.modules.notifications import router as notifications_module
from app.org.member_router import router as org_member_portal
from app.core.config import settings
from app.core.db import init_db
from app.application.recipe_service import generate_recipe


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    media_root = Path(__file__).resolve().parents[2] / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media_root), name="media")

    app.include_router(api_router)
    # include auth routes
    app.include_router(auth_module.router)
    # admin routes
    app.include_router(admin_module.router)
    # videos module
    app.include_router(videos_router.router, prefix="/videos")
    # chef module (public /chefs/* + dashboard /chef/me/*)
    app.include_router(chef_module.router, prefix="/chefs")
    # meal plan module
    app.include_router(meal_plan_module.router, prefix="/meal-plans")
    # org core (shared: register, me/*, members, groups, memberships)
    app.include_router(org_module.router, prefix="/org")
    # org type-specific sub-modules (each checks platform_module.is_active guard)
    app.include_router(corporate_module.router, prefix="/org/me/corporate")
    app.include_router(gym_module.router, prefix="/org/me/gym")
    app.include_router(nutrition_module.router, prefix="/org/me/nutrition")
    # org shared modules
    app.include_router(meal_batch_module, prefix="/org/me/meal-batches")
    app.include_router(custom_meal_planner_module, prefix="/org/me/custom-meal-planner")
    app.include_router(compliance_module, prefix="/org/me/compliance")
    app.include_router(content_module, prefix="/org/me/content")
    app.include_router(challenges_module, prefix="/org/me/challenges")
    app.include_router(notifications_module, prefix="/org/me/notifications")
    # member-facing portal (Tier 3 end-user endpoints)
    app.include_router(org_member_portal, prefix="/org/member")
    return app


app = create_app()


@app.post("/chat/phi3")
def chat_phi3(payload: BaseModel, request: Request):
    """
    Model-specific endpoint for phi3:latest via Ollama.
    Accepts JSON { "message": "..." }.
    """
    title = (getattr(payload, "message", "") or "").strip() or "Sample Recipe"
    try:
        return generate_recipe(title, provider="ollama:phi3:latest")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/chat/mistral")
def chat_mistral(payload: BaseModel, request: Request):
    title = (getattr(payload, "message", "") or "").strip() or "Sample Recipe"
    try:
        return generate_recipe(title, provider="ollama:mistral:latest")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/chat/llama3.1")
def chat_llama3(payload: BaseModel, request: Request):
    title = (getattr(payload, "message", "") or "").strip() or "Sample Recipe"
    try:
        return generate_recipe(title, provider="ollama:llama3.1:latest")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.on_event("startup")
def on_startup() -> None:
    init_db()
