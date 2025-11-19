"""
Tests for the rate limiter module.
"""

from unittest.mock import Mock

import pytest
from fastapi import HTTPException, Request

from rate_limiter import RateLimiter


def test_rate_limiter_allows_within_limit():
    """Test that rate limiter allows requests within limit."""
    limiter = RateLimiter()

    # Mock request
    request = Mock(spec=Request)
    request.headers = {}
    request.client = Mock()
    request.client.host = "192.168.1.1"

    # Should allow first 3 requests (limit is 10)
    for i in range(3):
        try:
            limiter.check_rate_limit(request, max_requests=10, window_seconds=60)
        except HTTPException:
            pytest.fail(f"Request {i+1} should not be rate limited")


def test_rate_limiter_blocks_over_limit():
    """Test that rate limiter blocks requests over limit."""
    limiter = RateLimiter()

    # Mock request
    request = Mock(spec=Request)
    request.headers = {}
    request.client = Mock()
    request.client.host = "192.168.1.2"

    # Make 3 requests (limit is 3)
    for i in range(3):
        limiter.check_rate_limit(request, max_requests=3, window_seconds=60)

    # 4th request should be blocked
    with pytest.raises(HTTPException) as exc_info:
        limiter.check_rate_limit(request, max_requests=3, window_seconds=60)

    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail
    assert "Retry-After" in exc_info.value.headers


def test_rate_limiter_respects_forwarded_ip():
    """Test that rate limiter uses X-Forwarded-For header."""
    limiter = RateLimiter()

    # Mock request with forwarded IP
    request = Mock(spec=Request)
    request.headers = {"X-Forwarded-For": "10.0.0.1, 192.168.1.1"}
    request.client = Mock()
    request.client.host = "192.168.1.100"

    # Should track by forwarded IP (10.0.0.1), not client IP
    limiter.check_rate_limit(request, max_requests=1, window_seconds=60)

    # Second request from same forwarded IP should be blocked
    with pytest.raises(HTTPException) as exc_info:
        limiter.check_rate_limit(request, max_requests=1, window_seconds=60)

    assert exc_info.value.status_code == 429


def test_rate_limiter_different_ips_independent():
    """Test that different IPs have independent rate limits."""
    limiter = RateLimiter()

    # First IP
    request1 = Mock(spec=Request)
    request1.headers = {}
    request1.client = Mock()
    request1.client.host = "192.168.1.10"

    # Second IP
    request2 = Mock(spec=Request)
    request2.headers = {}
    request2.client = Mock()
    request2.client.host = "192.168.1.20"

    # Make max requests from first IP
    for i in range(2):
        limiter.check_rate_limit(request1, max_requests=2, window_seconds=60)

    # First IP should be blocked
    with pytest.raises(HTTPException):
        limiter.check_rate_limit(request1, max_requests=2, window_seconds=60)

    # Second IP should still be allowed
    limiter.check_rate_limit(request2, max_requests=2, window_seconds=60)
