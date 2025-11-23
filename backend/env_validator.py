"""
Environment variable validation module.
Validates all required configuration at application startup.
"""

import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class EnvironmentValidationError(Exception):
    """Raised when environment validation fails."""
    pass


def validate_url(url: str, name: str) -> Tuple[bool, Optional[str]]:
    """Validate URL format."""
    if not url:
        return False, f"{name} is empty"

    if not (url.startswith('http://') or url.startswith('https://')):
        return False, f"{name} must start with http:// or https://"

    return True, None


def validate_file_exists(path: str, name: str, base_dir: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Validate that a file exists."""
    if base_dir:
        full_path = Path(base_dir) / path
    else:
        full_path = Path(path)

    if not full_path.exists():
        return False, f"{name} file not found at: {full_path}"

    return True, None


def validate_api_key(key: str, name: str, min_length: int = 20) -> Tuple[bool, Optional[str]]:
    """Validate API key format."""
    if not key:
        return False, f"{name} is empty"

    if len(key) < min_length:
        return False, f"{name} appears too short (< {min_length} characters)"

    # Check for common placeholders
    placeholders = ['your-key-here', 'placeholder', 'xxx', 'test', 'dummy']
    if any(placeholder in key.lower() for placeholder in placeholders):
        return False, f"{name} contains a placeholder value"

    return True, None


def validate_phone_number(phone: str, name: str) -> Tuple[bool, Optional[str]]:
    """Validate phone number format."""
    if not phone:
        return False, f"{name} is empty"

    # Basic validation - should start with + or digit
    if not (phone.startswith('+') or phone[0].isdigit()):
        return False, f"{name} should start with + or a digit"

    # Remove common separators and check if remaining is digits
    digits_only = phone.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
    if not digits_only.isdigit():
        return False, f"{name} contains invalid characters"

    return True, None


def validate_email(email: str, name: str) -> Tuple[bool, Optional[str]]:
    """Validate email format."""
    if not email:
        return False, f"{name} is empty"

    if '@' not in email or '.' not in email.split('@')[1]:
        return False, f"{name} is not a valid email address"

    return True, None


def validate_environment() -> None:
    """
    Validate all required environment variables at startup.
    Raises EnvironmentValidationError if validation fails.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # Determine environment
    env = os.getenv('ENV', 'development')
    is_production = env == 'production'

    logger.info(f"Validating environment for: {env}")

    # Critical: Database
    database_url = os.getenv('DATABASE_URL', '')
    if database_url:
        is_valid, error = validate_url(database_url, 'DATABASE_URL')
        if not is_valid:
            errors.append(error or "Invalid DATABASE_URL")
    else:
        errors.append("DATABASE_URL is required")

    # Critical: Supabase (production only)
    if is_production:
        supabase_url = os.getenv('SUPABASE_URL', '')
        if supabase_url:
            is_valid, error = validate_url(supabase_url, 'SUPABASE_URL')
            if not is_valid:
                errors.append(error or "Invalid SUPABASE_URL")
        else:
            errors.append("SUPABASE_URL is required in production")

        supabase_anon_key = os.getenv('SUPABASE_ANON_KEY', '')
        is_valid, error = validate_api_key(supabase_anon_key, 'SUPABASE_ANON_KEY', 30)
        if not is_valid:
            errors.append(error or "Invalid SUPABASE_ANON_KEY")

        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        is_valid, error = validate_api_key(supabase_service_key, 'SUPABASE_SERVICE_ROLE_KEY', 30)
        if not is_valid:
            errors.append(error or "Invalid SUPABASE_SERVICE_ROLE_KEY")

    # Critical: OpenAI API Key
    openai_key = os.getenv('OPENAI_API_KEY', '')
    is_valid, error = validate_api_key(openai_key, 'OPENAI_API_KEY')
    if not is_valid:
        errors.append(error or "Invalid OPENAI_API_KEY")

    # Critical: Google Calendar
    calendar_id = os.getenv('GOOGLE_CALENDAR_ID', '')
    if not calendar_id:
        errors.append("GOOGLE_CALENDAR_ID is required")
    elif '@' not in calendar_id:
        warnings.append("GOOGLE_CALENDAR_ID should typically contain @ (e.g., xxx@group.calendar.google.com)")

    # Google credentials files (check in parent directory)
    base_dir = str(Path(__file__).parent.parent)
    creds_file = os.getenv('GOOGLE_CREDENTIALS_FILE', 'credentials.json')
    is_valid, error = validate_file_exists(creds_file, 'Google credentials', base_dir)
    if not is_valid:
        # In production on Railway, credentials might be base64 encoded
        if is_production and os.getenv('GOOGLE_CREDENTIALS_BASE64'):
            warnings.append("Using base64-encoded Google credentials")
        else:
            errors.append(error or "Google credentials file not found")

    # Important: Med Spa Information
    med_spa_name = os.getenv('MED_SPA_NAME', '')
    if not med_spa_name or med_spa_name == 'Luxury Med Spa':
        warnings.append("MED_SPA_NAME not customized (using default)")

    med_spa_phone = os.getenv('MED_SPA_PHONE', '')
    if med_spa_phone and med_spa_phone != '+1234567890':
        is_valid, error = validate_phone_number(med_spa_phone, 'MED_SPA_PHONE')
        if not is_valid:
            warnings.append(error or "Invalid MED_SPA_PHONE")
    else:
        warnings.append("MED_SPA_PHONE not customized or missing")

    med_spa_email = os.getenv('MED_SPA_EMAIL', '')
    if med_spa_email and med_spa_email != 'hello@luxurymedspa.com':
        is_valid, error = validate_email(med_spa_email, 'MED_SPA_EMAIL')
        if not is_valid:
            warnings.append(error or "Invalid MED_SPA_EMAIL")
    else:
        warnings.append("MED_SPA_EMAIL not customized or missing")

    # Optional: Twilio (only warn if partially configured)
    twilio_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
    twilio_token = os.getenv('TWILIO_AUTH_TOKEN', '')
    twilio_phone = os.getenv('TWILIO_PHONE_NUMBER', '')

    twilio_configured = any([twilio_sid, twilio_token, twilio_phone])
    twilio_fully_configured = all([twilio_sid, twilio_token, twilio_phone])

    if twilio_configured and not twilio_fully_configured:
        warnings.append("Twilio is partially configured (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)")

    # Print warnings
    if warnings:
        logger.warning("=" * 80)
        logger.warning("Environment Validation Warnings:")
        for warning in warnings:
            logger.warning(f"  ⚠️  {warning}")
        logger.warning("=" * 80)

    # Handle errors
    if errors:
        logger.error("=" * 80)
        logger.error("Environment Validation FAILED:")
        for error in errors:
            logger.error(f"  ❌ {error}")
        logger.error("=" * 80)
        logger.error("Please fix the above errors before starting the application")
        raise EnvironmentValidationError(
            f"Environment validation failed with {len(errors)} error(s). "
            f"See logs above for details."
        )

    logger.info("✅ Environment validation passed successfully")


def get_environment_summary() -> Dict[str, str]:
    """Get a summary of the current environment configuration (safe to log)."""
    def mask_secret(value: str, show_chars: int = 4) -> str:
        """Mask a secret value, showing only the first few characters."""
        if not value or len(value) <= show_chars:
            return "***"
        return f"{value[:show_chars]}...***"

    return {
        "ENV": os.getenv('ENV', 'development'),
        "APP_NAME": os.getenv('APP_NAME', 'Med Spa Voice AI'),
        "DATABASE_URL": mask_secret(os.getenv('DATABASE_URL', '')),
        "SUPABASE_URL": os.getenv('SUPABASE_URL', 'not set'),
        "OPENAI_API_KEY": mask_secret(os.getenv('OPENAI_API_KEY', '')),
        "GOOGLE_CALENDAR_ID": os.getenv('GOOGLE_CALENDAR_ID', 'not set'),
        "MED_SPA_NAME": os.getenv('MED_SPA_NAME', 'not set'),
        "TWILIO_CONFIGURED": "yes" if os.getenv('TWILIO_ACCOUNT_SID') else "no",
    }


if __name__ == "__main__":
    # Allow running this module directly for validation testing
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s"
    )

    try:
        validate_environment()
        print("\n✅ Environment validation passed!")
        print("\nEnvironment Summary:")
        for key, value in get_environment_summary().items():
            print(f"  {key}: {value}")
    except EnvironmentValidationError as e:
        print(f"\n❌ Validation failed: {e}")
        sys.exit(1)
