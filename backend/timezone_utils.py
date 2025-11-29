"""
Timezone utilities for the Med Spa application.

All date/time filtering should use the med spa's configured timezone
to ensure consistent behavior regardless of server timezone.
"""

from datetime import datetime, timedelta
from typing import Tuple

import pytz

from config import get_settings


def get_med_spa_timezone() -> pytz.BaseTzInfo:
    """Get the configured timezone for the med spa."""
    settings = get_settings()
    return pytz.timezone(settings.MED_SPA_TIMEZONE)


def get_current_time_in_med_spa_tz() -> datetime:
    """Get the current time in the med spa's timezone."""
    tz = get_med_spa_timezone()
    return datetime.now(tz)


def get_period_range_utc(period: str, start_date: str = None, end_date: str = None) -> Tuple[datetime, datetime]:
    """
    Calculate UTC datetime range for a given period, based on med spa timezone.
    
    This ensures that "today" means "today in the med spa's timezone",
    not "today in UTC".
    
    Args:
        period: One of "today", "week", "month", "custom"
        start_date: ISO format date string for custom period
        end_date: ISO format date string for custom period
        
    Returns:
        Tuple of (start_utc, end_utc) as timezone-naive UTC datetimes
    """
    tz = get_med_spa_timezone()
    now_local = datetime.now(tz)
    
    if period == "today":
        # Start of today in med spa timezone
        start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = now_local
    elif period == "week":
        # 7 days ago from now
        start_local = now_local - timedelta(days=7)
        end_local = now_local
    elif period == "month":
        # 30 days ago from now
        start_local = now_local - timedelta(days=30)
        end_local = now_local
    elif period == "custom" and start_date and end_date:
        # Parse custom dates as med spa timezone dates
        start_local = tz.localize(datetime.fromisoformat(start_date))
        # End date should be end of day
        end_parsed = datetime.fromisoformat(end_date)
        end_local = tz.localize(end_parsed.replace(hour=23, minute=59, second=59))
    else:
        # Default to last 24 hours
        start_local = now_local - timedelta(days=1)
        end_local = now_local
    
    # Convert to UTC (naive) for database queries
    # Database stores naive UTC datetimes
    start_utc = start_local.astimezone(pytz.UTC).replace(tzinfo=None)
    end_utc = end_local.astimezone(pytz.UTC).replace(tzinfo=None)
    
    return start_utc, end_utc


def utc_to_local_iso(dt: datetime) -> str:
    """
    Convert a naive UTC datetime to an ISO string in the med spa's timezone.
    
    This is used for API responses so the frontend receives timestamps
    in the correct local timezone.
    
    Args:
        dt: A naive UTC datetime from the database
        
    Returns:
        ISO format string with timezone offset (e.g., "2025-11-28T14:30:00-05:00")
    """
    if dt is None:
        return None
    
    tz = get_med_spa_timezone()
    
    # Assume input is naive UTC
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    
    local_dt = dt.astimezone(tz)
    return local_dt.isoformat()


def format_datetime_for_display(dt: datetime, include_time: bool = True) -> str:
    """
    Format a UTC datetime for display in the med spa's timezone.
    
    Args:
        dt: A naive UTC datetime from the database
        include_time: Whether to include time in the output
        
    Returns:
        Formatted string in med spa timezone
    """
    if dt is None:
        return ""
    
    tz = get_med_spa_timezone()
    
    # Assume input is naive UTC
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    
    local_dt = dt.astimezone(tz)
    
    if include_time:
        return local_dt.strftime("%Y-%m-%d %I:%M %p %Z")
    return local_dt.strftime("%Y-%m-%d")
