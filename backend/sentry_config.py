"""
Sentry error monitoring configuration for FastAPI backend.
"""

import logging
import os
from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    """
    Initialize Sentry error monitoring.
    Only initializes if SENTRY_DSN is configured in environment.
    """
    sentry_dsn = os.getenv("SENTRY_DSN")
    environment = os.getenv("ENV", "development")

    if not sentry_dsn:
        logger.info("Sentry DSN not configured, skipping error monitoring setup")
        return

    try:
        # Determine sample rate based on environment
        traces_sample_rate = 0.1 if environment == "production" else 1.0

        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=environment,
            # Performance monitoring
            traces_sample_rate=traces_sample_rate,
            # Enable profiling
            profiles_sample_rate=0.1 if environment == "production" else 1.0,
            # Release tracking (use git commit hash if available)
            release=os.getenv("GIT_COMMIT_SHA", "unknown"),
            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.INFO,  # Capture info and above as breadcrumbs
                    event_level=logging.ERROR,  # Send errors to Sentry
                ),
            ],
            # Filter out sensitive data
            before_send=filter_sensitive_data,
            # Send default PII (email, IP, user ID)
            send_default_pii=False,  # Disable to prevent accidental PII leaks
        )

        logger.info(
            f"Sentry initialized successfully for environment: {environment}"
        )
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")


def filter_sensitive_data(event, hint):
    """
    Filter sensitive data from Sentry events before sending.
    This prevents PII and sensitive credentials from being sent to Sentry.
    """
    # Remove sensitive headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        sensitive_headers = [
            "authorization",
            "cookie",
            "x-api-key",
            "x-auth-token",
        ]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[FILTERED]"

    # Remove sensitive cookies
    if "request" in event and "cookies" in event["request"]:
        event["request"]["cookies"] = "[FILTERED]"

    # Filter environment variables
    if "server_name" in event:
        # Don't send server hostname (might contain sensitive info)
        event["server_name"] = "[FILTERED]"

    # Filter sensitive context data
    if "contexts" in event:
        contexts = event["contexts"]
        # Remove OS user info
        if "os" in contexts and "name" in contexts["os"]:
            contexts["os"]["name"] = "[FILTERED]"

    # Filter user data (if accidentally included)
    if "user" in event:
        user = event["user"]
        # Keep user ID for tracking, but remove email/username
        if "email" in user:
            user["email"] = "[FILTERED]"
        if "username" in user:
            user["username"] = "[FILTERED]"
        if "ip_address" in user:
            user["ip_address"] = "[FILTERED]"

    return event


def set_user_context(user_id: Optional[str] = None, role: Optional[str] = None):
    """
    Set user context for Sentry events.
    This helps track which user encountered the error.
    """
    if not user_id:
        return

    sentry_sdk.set_user({"id": user_id, "role": role})


def capture_exception(
    error: Exception,
    context: Optional[dict] = None,
    level: str = "error",
):
    """
    Capture an exception and send it to Sentry with additional context.

    Args:
        error: The exception to capture
        context: Additional context to include with the error
        level: Severity level (debug, info, warning, error, fatal)
    """
    if context:
        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            scope.level = level
            sentry_sdk.capture_exception(error)
    else:
        sentry_sdk.capture_exception(error)


def capture_message(
    message: str,
    level: str = "info",
    context: Optional[dict] = None,
):
    """
    Capture a message and send it to Sentry.

    Args:
        message: The message to capture
        level: Severity level (debug, info, warning, error, fatal)
        context: Additional context to include
    """
    if context:
        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            scope.level = level
            sentry_sdk.capture_message(message)
    else:
        sentry_sdk.capture_message(message, level=level)
