"""
Vector store client: bridge to Qdrant or local in-memory similarity search.

Uses Qdrant when configured; otherwise falls back to a simple in-memory
store with cosine similarity for local / dev use.
"""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)

# Optional Qdrant client (install qdrant-client to use)
try:
    from qdrant_client import QdrantClient as _QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams
    _QDRANT_AVAILABLE = True
except ImportError:
    _QDRANT_AVAILABLE = False
    _QdrantClient = None
    PointStruct = None
    Distance = None
    VectorParams = None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class LocalVectorStore:
    """In-memory vector store with cosine similarity search (local-first fallback)."""

    def __init__(self, collection_name: str, vector_size: int):
        self.collection_name = collection_name
        self.vector_size = vector_size
        self._points: list[tuple[str, list[float], dict[str, Any]]] = []  # id, vector, payload

    def upsert(self, points: list[tuple[str, list[float], dict[str, Any]]]) -> None:
        for point_id, vector, payload in points:
            if len(vector) != self.vector_size:
                continue
            # Replace existing id or append
            self._points = [(i, v, p) for i, v, p in self._points if i != point_id]
            self._points.append((point_id, vector, payload))

    def search(
        self,
        query_vector: list[float],
        limit: int = 10,
        score_threshold: float | None = None,
    ) -> list[tuple[str, float, dict[str, Any]]]:
        if len(query_vector) != self.vector_size:
            return []
        scored = []
        for point_id, vector, payload in self._points:
            score = _cosine_similarity(query_vector, vector)
            if score_threshold is not None and score < score_threshold:
                continue
            scored.append((point_id, score, payload))
        scored.sort(key=lambda x: -x[1])
        return scored[:limit]


class VectorClient:
    """
    Bridge to Qdrant or local similarity store.

    Set qdrant_url (e.g. http://localhost:6333) to use Qdrant; otherwise
    uses an in-memory LocalVectorStore per collection.
    """

    def __init__(
        self,
        *,
        qdrant_url: str | None = None,
        qdrant_api_key: str | None = None,
        vector_size: int = 384,
    ):
        self.vector_size = vector_size
        self._qdrant_url = qdrant_url
        self._qdrant_api_key = qdrant_api_key
        self._client: _QdrantClient | None = None
        self._local_stores: dict[str, LocalVectorStore] = {}

        if qdrant_url and _QDRANT_AVAILABLE:
            try:
                self._client = _QdrantClient(
                    url=qdrant_url,
                    api_key=qdrant_api_key or None,
                )
                logger.info("VectorClient using Qdrant at %s", qdrant_url)
            except Exception as e:
                logger.warning("Qdrant connection failed, using local store: %s", e)
                self._client = None
        else:
            if qdrant_url and not _QDRANT_AVAILABLE:
                logger.warning("qdrant-client not installed; using local vector store")
            else:
                logger.info("No Qdrant URL configured; using local vector store")

    def _get_local_store(self, collection_name: str) -> LocalVectorStore:
        if collection_name not in self._local_stores:
            self._local_stores[collection_name] = LocalVectorStore(
                collection_name, self.vector_size
            )
        return self._local_stores[collection_name]

    def ensure_collection(self, collection_name: str, vector_size: int | None = None) -> None:
        size = vector_size or self.vector_size
        if self._client and _QDRANT_AVAILABLE:
            from qdrant_client.http.models import VectorParams, Distance
            try:
                self._client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=size, distance=Distance.COSINE),
                )
            except Exception:
                # Collection may already exist
                pass
            return
        self._get_local_store(collection_name).vector_size = size

    def upsert(
        self,
        collection_name: str,
        points: list[tuple[str, list[float], dict[str, Any]]],
        vector_size: int | None = None,
    ) -> None:
        size = vector_size or self.vector_size
        if self._client and _QDRANT_AVAILABLE and PointStruct is not None:
            structs = [
                PointStruct(id=pid, vector=vec, payload=payload)
                for pid, vec, payload in points
            ]
            self._client.upsert(collection_name=collection_name, points=structs)
            return
        store = self._get_local_store(collection_name)
        store.vector_size = size
        store.upsert(points)

    def search(
        self,
        collection_name: str,
        query_vector: list[float],
        limit: int = 10,
        score_threshold: float | None = None,
    ) -> list[tuple[str, float, dict[str, Any]]]:
        if self._client and _QDRANT_AVAILABLE:
            results = self._client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit,
                score_threshold=score_threshold,
            )
            return [
                (str(h.id), float(h.score or 0), h.payload or {})
                for h in results
            ]
        store = self._get_local_store(collection_name)
        return store.search(query_vector, limit=limit, score_threshold=score_threshold)
