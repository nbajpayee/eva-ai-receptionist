"""
Simple in-memory rate limiter for API endpoints.

This provides basic rate limiting without requiring Redis or external services.
For production with multiple workers, consider using Redis-based rate limiting.
"""

import logging
import time
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple token bucket rate limiter.

    Tracks requests per IP address with configurable limits.
    """

    def __init__(self):
        # Store: {ip_address: (last_request_time, request_count)}
        self._requests: Dict[str, Tuple[float, int]] = {}
        self._cleanup_interval = 3600  # Clean up old entries every hour
        self._last_cleanup = time.time()

    def check_rate_limit(
        self, request: Request, max_requests: int = 10, window_seconds: int = 60
    ) -> None:
        """
        Check if request should be rate limited.

        Args:
            request: FastAPI request object
            max_requests: Maximum number of requests allowed in window
            window_seconds: Time window in seconds

        Raises:
            HTTPException: 429 if rate limit exceeded
        """
        # Get client IP
        client_ip = self._get_client_ip(request)

        # Cleanup old entries periodically
        self._cleanup_if_needed()

        # Get current time
        current_time = time.time()

        # Check if IP has previous requests
        if client_ip in self._requests:
            last_time, count = self._requests[client_ip]

            # Check if we're still in the same window
            if current_time - last_time < window_seconds:
                if count >= max_requests:
                    retry_after = int(window_seconds - (current_time - last_time))
                    logger.warning(
                        f"Rate limit exceeded for IP {client_ip}: "
                        f"{count} requests in {int(current_time - last_time)}s"
                    )
                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                        headers={"Retry-After": str(retry_after)},
                    )
                # Increment count in same window
                self._requests[client_ip] = (last_time, count + 1)
            else:
                # New window, reset count
                self._requests[client_ip] = (current_time, 1)
        else:
            # First request from this IP
            self._requests[client_ip] = (current_time, 1)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, considering proxies."""
        # Check for forwarded IP (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take first IP in chain
            return forwarded.split(",")[0].strip()

        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    def _cleanup_if_needed(self):
        """Remove old entries to prevent memory leak."""
        current_time = time.time()

        if current_time - self._last_cleanup > self._cleanup_interval:
            # Remove entries older than 1 hour
            cutoff_time = current_time - 3600
            self._requests = {
                ip: (t, c) for ip, (t, c) in self._requests.items() if t > cutoff_time
            }
            self._last_cleanup = current_time
            logger.info(f"Rate limiter cleanup: {len(self._requests)} active IPs")


# Global rate limiter instance
rate_limiter = RateLimiter()
