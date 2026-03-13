# Vector store and embedding bridge (Qdrant or local similarity).

from app.infrastructure.vector.vector_client import VectorClient
from app.infrastructure.vector.embedding_service import EmbeddingService

__all__ = ["VectorClient", "EmbeddingService"]
