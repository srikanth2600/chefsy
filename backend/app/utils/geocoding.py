"""
Geocoding utility — resolves a structured address to (latitude, longitude)
using the OpenStreetMap Nominatim API (free, no API key required).
"""
import logging
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_HEADERS = {"User-Agent": "GharkaChef/1.0 (contact@gharka.com)"}


async def geocode_address(
    address_line1: Optional[str] = None,
    address_line2: Optional[str] = None,
    city: Optional[str] = None,
    postcode: Optional[str] = None,
    country: Optional[str] = None,
) -> Optional[Tuple[float, float]]:
    """
    Returns (latitude, longitude) for the given address parts, or None if
    geocoding fails or no result is found. Non-blocking — uses httpx async.
    """
    parts = [p.strip() for p in [address_line1, address_line2, city, postcode, country] if p and p.strip()]
    if not parts:
        return None

    query = ", ".join(parts)
    params = {"q": query, "format": "json", "limit": 1, "addressdetails": 0}

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(_NOMINATIM_URL, params=params, headers=_HEADERS)
            resp.raise_for_status()
            data = resp.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        logger.warning("Geocoding failed for query %r: %s", query, exc)

    return None
