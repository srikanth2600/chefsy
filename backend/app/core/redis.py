import redis.asyncio as redis

redis_client = redis.Redis(
    host="localhost",  # because backend is local
    port=6379,
    decode_responses=True
)