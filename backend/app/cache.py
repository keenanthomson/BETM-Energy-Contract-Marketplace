import json
import logging
import os
from typing import Any

from dotenv import load_dotenv
from redis.asyncio import Redis
from redis.exceptions import RedisError

load_dotenv()

log = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")
DEFAULT_TTL_SECONDS = 60

_client: Redis | None = None


def get_redis() -> Redis | None:
    """Singleton async Redis client. Returns None when REDIS_URL is unset,
    which turns every cache helper into a no-op so the app runs fine without
    a Redis instance (e.g. local dev)."""
    global _client
    if not REDIS_URL:
        return None
    if _client is None:
        _client = Redis.from_url(REDIS_URL, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def cache_get(key: str) -> Any | None:
    client = get_redis()
    if client is None:
        return None
    try:
        raw = await client.get(key)
    except RedisError as e:
        log.warning("cache_get failed for %s: %s", key, e)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def cache_set(
    key: str, value: Any, ttl_seconds: int = DEFAULT_TTL_SECONDS
) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        await client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except RedisError as e:
        log.warning("cache_set failed for %s: %s", key, e)


async def cache_invalidate(*patterns: str) -> None:
    """Delete all keys matching each glob pattern (e.g. "contracts:*")."""
    client = get_redis()
    if client is None:
        return
    try:
        for pattern in patterns:
            keys = [k async for k in client.scan_iter(match=pattern)]
            if keys:
                await client.delete(*keys)
    except RedisError as e:
        log.warning("cache_invalidate failed for %s: %s", patterns, e)


def make_key(prefix: str, **params: Any) -> str:
    """Deterministic cache key from a prefix + query params. Skips None
    values so a call with no filters matches the same key every time."""
    parts = [f"{k}={v}" for k, v in sorted(params.items()) if v is not None]
    return f"{prefix}:{'&'.join(parts)}" if parts else f"{prefix}:all"
