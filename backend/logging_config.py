"""
Structured logging configuration for FastAPI backend.
Replaces print statements and basic logging with structured logging.
"""

import logging
import sys
from typing import Any, Dict
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter that adds context and filters sensitive data.
    """

    SENSITIVE_FIELDS = {
        'password', 'token', 'access_token', 'refresh_token',
        'api_key', 'secret', 'authorization', 'cookie',
        'email', 'phone', 'ssn', 'credit_card'
    }

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)

        # Add standard fields
        log_record['timestamp'] = self.formatTime(record, self.datefmt)
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno

        # Add extra fields from record
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        if hasattr(record, 'duration_ms'):
            log_record['duration_ms'] = record.duration_ms

        # Filter sensitive data
        self._filter_sensitive_data(log_record)

    def _filter_sensitive_data(self, log_record: Dict[str, Any]) -> None:
        """Recursively filter sensitive data from log record."""
        for key in list(log_record.keys()):
            if key.lower() in self.SENSITIVE_FIELDS:
                log_record[key] = '[REDACTED]'
            elif isinstance(log_record[key], dict):
                self._filter_sensitive_data(log_record[key])
            elif isinstance(log_record[key], str) and len(log_record[key]) > 50:
                # Truncate very long strings (might be tokens)
                if any(sensitive in key.lower() for sensitive in ['token', 'key', 'secret']):
                    log_record[key] = log_record[key][:10] + '...[REDACTED]'


def setup_logging(
    level: str = 'INFO',
    json_logging: bool = True,
    log_file: str = None
) -> None:
    """
    Configure structured logging for the application.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logging: Whether to use JSON formatted logs
        log_file: Optional file path to write logs to
    """
    root_logger = logging.getLogger()

    # Remove existing handlers
    root_logger.handlers = []

    # Set level
    root_logger.setLevel(getattr(logging, level.upper()))

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)

    if json_logging:
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler (optional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Set specific loggers to appropriate levels
    logging.getLogger('uvicorn').setLevel(logging.INFO)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.

    Args:
        name: Module name (typically __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


# Context logger that adds request context to all logs
class RequestContextLogger:
    """Logger that includes request context in all log messages."""

    def __init__(self, logger: logging.Logger, request_id: str = None, user_id: str = None):
        self.logger = logger
        self.request_id = request_id
        self.user_id = user_id

    def _add_context(self, extra: dict = None) -> dict:
        """Add request context to extra fields."""
        if extra is None:
            extra = {}

        if self.request_id:
            extra['request_id'] = self.request_id
        if self.user_id:
            extra['user_id'] = self.user_id

        return extra

    def debug(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.debug(msg, *args, **kwargs)

    def info(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.info(msg, *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.warning(msg, *args, **kwargs)

    def error(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.error(msg, *args, **kwargs)

    def critical(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.critical(msg, *args, **kwargs)

    def exception(self, msg: str, *args, **kwargs):
        extra = self._add_context(kwargs.get('extra'))
        kwargs['extra'] = extra
        self.logger.exception(msg, *args, **kwargs)
