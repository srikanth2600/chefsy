"""
Embedding service: bridge for producing text embeddings.

Supports local-first (simple or on-device model) and optional remote APIs
(e.g. OpenAI, Qdrant's embedder). Used with VectorClient for similarity search.
"""

from __future__ import annotations

import hashlib
import logging
import random
from typing import Protocol

logger = logging.getLogger(__name__)

# Optional: OpenAI for embeddings
try:
    import openai
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


class EmbeddingProvider(Protocol):
    """Protocol for embedding providers (local or remote)."""

    def embed(self, text: str) -> list[float]:
        ...

    @property
    def dimension(self) -> int:
        ...


class LocalEmbeddingProvider:
    """
    Local-first embedding: deterministic pseudo-embeddings from text hash.

    Use for dev or when no API is configured. Same text always yields the same
    vector; good for testing and local similarity. Replace with a real model
    (e.g. sentence-transformers) or API when needed.
    """

    def __init__(self, dimension: int = 384, seed: int = 0):
        self._dimension = dimension
        self._rng = random.Random(seed)

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, text: str) -> list[float]:
        h = hashlib.sha256(text.encode("utf-8")).digest()
        self._rng.seed(int.from_bytes(h[:8], "big"))
        return [self._rng.gauss(0, 0.1) for _ in range(self._dimension)]


class OpenAIEmbeddingProvider:
    """OpenAI embeddings (e.g. text-embedding-3-small). Requires OPENAI_API_KEY."""

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        dimension: int | None = None,
    ):
        self._client = openai.OpenAI(api_key=api_key)
        self._model = model
        self._dimension = dimension or 1536  # default for text-embedding-3-small

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, text: str) -> list[float]:
        r = self._client.embeddings.create(
            model=self._model,
            input=text.strip() or " ",
        )
        vec = r.data[0].embedding
        self._dimension = len(vec)
        return vec


class EmbeddingService:
    """
    Single entry point for embeddings: local-first, then optional OpenAI (or other).

    Configure via constructor; can be wired to app settings (e.g. OPENAI_API_KEY,
    embedding_model, use_local_embeddings).
    """

    def __init__(
        self,
        *,
        openai_api_key: str | None = None,
        openai_embedding_model: str = "text-embedding-3-small",
        dimension: int = 384,
        use_local: bool | None = None,
    ):
        self._dimension = dimension
        self._provider: EmbeddingProvider

        use_local = use_local if use_local is not None else not openai_api_key
        if use_local or not (openai_api_key and _OPENAI_AVAILABLE):
            self._provider = LocalEmbeddingProvider(dimension=dimension)
            logger.info("EmbeddingService using local pseudo-embeddings (dim=%s)", dimension)
        else:
            self._provider = OpenAIEmbeddingProvider(
                api_key=openai_api_key,
                model=openai_embedding_model,
                dimension=dimension,
            )
            self._dimension = self._provider.dimension
            logger.info("EmbeddingService using OpenAI %s (dim=%s)", openai_embedding_model, self._dimension)

    @property
    def dimension(self) -> int:
        return self._provider.dimension

    def embed(self, text: str) -> list[float]:
        return self._provider.embed(text)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]
