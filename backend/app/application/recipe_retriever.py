"""
Bridge between the application and the vector store.

Uses EmbeddingService for text→vector and VectorClient for similarity search
and indexing. Configured for local vector store by default (no Qdrant required).
"""

from __future__ import annotations

from app.infrastructure.vector.vector_client import VectorClient
from app.infrastructure.vector.embedding_service import EmbeddingService


def build_recipe_text_for_index(recipe: dict) -> str:
    parts = []

    parts.append(recipe.get("title", ""))

    for ing in recipe.get("ingredients", []):
        parts.append(ing.get("name", "") if isinstance(ing, dict) else ing)

    parts.extend(recipe.get("steps", []))

    if recipe.get("tags"):
        parts.extend(recipe["tags"])

    ai = recipe.get("ai_context") or {}

    # Inject semantic understanding
    parts.append(ai.get("user_intent", ""))
    parts.append(ai.get("health_goal", ""))
    parts.append(ai.get("diet_type", ""))
    parts.append(ai.get("protein_focus", ""))
    parts.append(ai.get("cooking_style", ""))

    for k in ai.get("key_ingredients", []):
        parts.append(k)

    return " ".join([str(p) for p in parts if p])


class RecipeRetriever:
    def __init__(self, collection_name: str = "recipes"):
        # Use existing local vector store (no Qdrant required)
        self.embedder = EmbeddingService()
        self.vector = VectorClient(
            vector_size=self.embedder.dimension,
        )
        self.collection_name = collection_name
        self.vector.ensure_collection(collection_name, self.embedder.dimension)

    def search_similar(self, query: str, limit: int = 1):
        """
        Convert user query into embedding and search similar recipes.
        """
        query_vector = self.embedder.embed(query)
        results = self.vector.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
        )
        return results

    def index_recipe(self, recipe_id: int, recipe_text: str, intent_tags: list | None = None):
        """
        Store recipe embedding so future searches can reuse it.
        intent_tags: optional list of intent labels (e.g. from _extract_intent_keywords) for cache matching.
        """
        payload = {"recipe_id": recipe_id, "intent_tags": intent_tags or []}
        vector = self.embedder.embed(recipe_text)
        self.vector.upsert(
            collection_name=self.collection_name,
            points=[(str(recipe_id), vector, payload)],
        )
