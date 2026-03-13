"""
Compatibility wrapper.

The recipe generation implementation has been moved to the application layer:
  app.application.recipe_service.generate_recipe

This module re-exports the application function so existing imports continue to work.
"""
from app.application.recipe_service import generate_recipe  # noqa: F401

__all__ = ["generate_recipe"]
