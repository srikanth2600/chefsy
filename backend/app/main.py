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
