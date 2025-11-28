from __future__ import annotations

import logging
from typing import Any, Dict, Optional


_logger = logging.getLogger("analytics.metrics")


def record_tool_execution(
    tool_name: str,
    channel: str,
    success: bool,
    latency_ms: Optional[float] = None,
    error_code: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    payload: Dict[str, Any] = {
        "tool_name": tool_name,
        "channel": channel,
        "success": bool(success),
        "latency_ms": latency_ms,
        "error_code": error_code,
    }
    if extra:
        payload.update(extra)
    _logger.info("tool_execution", extra={"tool_execution": payload})


def record_calendar_error(
    reason: str,
    http_status: Optional[int] = None,
    channel: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    payload: Dict[str, Any] = {
        "reason": reason,
        "http_status": http_status,
        "channel": channel,
    }
    if extra:
        payload.update(extra)
    _logger.warning("calendar_error", extra={"calendar_error": payload})
