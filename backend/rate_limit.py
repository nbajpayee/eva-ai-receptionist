"""
Rate limiting middleware for FastAPI application.
Protects API endpoints from abuse and DDoS attacks.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import Request
from typing import Optional
import os


def get_client_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    Uses the following priority:
    1. Authenticated user ID (if available)
    2. API key (if provided in headers)
    3. Client IP address
    """
    # Try to get user ID from auth context (if authenticated)
    if hasattr(request.state, "user") and request.state.user:
        user_id = getattr(request.state.user, "id", None)
        if user_id:
            return f"user:{user_id}"

    # Try to get API key from headers (for programmatic access)
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"apikey:{api_key}"

    # Fall back to IP address
    return get_remote_address(request)


# Initialize rate limiter
# Uses in-memory storage by default (fine for single instance)
# For multi-instance deployments, use Redis: storage_uri="redis://localhost:6379"
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["1000 per hour"],  # Global default limit
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI", "memory://"),
    headers_enabled=True,  # Return rate limit headers
)


# Rate limit configurations for different endpoint types
class RateLimits:
    """Predefined rate limits for different endpoint categories."""

    # Authentication endpoints (more restrictive to prevent brute force)
    AUTH = "5 per minute"

    # Public endpoints (moderate limits)
    PUBLIC = "100 per minute"

    # Admin endpoints (higher limits for authenticated users)
    ADMIN = "300 per minute"

    # Data modification endpoints (POST, PUT, DELETE)
    WRITE = "60 per minute"

    # Read endpoints (GET)
    READ = "200 per minute"

    # Voice/WebSocket endpoints (very high for real-time)
    REALTIME = "1000 per minute"

    # Webhook endpoints (high for external services)
    WEBHOOK = "500 per minute"

    # Health/Status endpoints (unlimited)
    HEALTH = "10000 per minute"


def get_rate_limit_handler():
    """Get the rate limit exceeded handler."""
    return _rate_limit_exceeded_handler


def get_limiter():
    """Get the rate limiter instance."""
    return limiter
