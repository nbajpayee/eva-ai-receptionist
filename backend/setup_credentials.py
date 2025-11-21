"""
Setup script to decode Google Calendar credentials from environment variables.
This runs before the main app starts in Railway deployment.
"""
import base64
import os
from pathlib import Path


def setup_google_credentials():
    """Decode base64-encoded credentials from environment variables and write to files."""
    credentials_b64 = os.getenv("GOOGLE_CREDENTIALS_BASE64")
    token_b64 = os.getenv("GOOGLE_TOKEN_BASE64")

    if credentials_b64:
        credentials_json = base64.b64decode(credentials_b64).decode("utf-8")
        Path("credentials.json").write_text(credentials_json)
        print("✓ Google credentials.json created from environment variable")
    else:
        print("⚠ GOOGLE_CREDENTIALS_BASE64 not set - Google Calendar will not work")

    if token_b64:
        token_json = base64.b64decode(token_b64).decode("utf-8")
        Path("token.json").write_text(token_json)
        print("✓ Google token.json created from environment variable")
    else:
        print("⚠ GOOGLE_TOKEN_BASE64 not set - Google Calendar may require re-authentication")


if __name__ == "__main__":
    setup_google_credentials()
