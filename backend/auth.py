"""
Authentication and authorization module for provider endpoints.

Provides:
- API key authentication
- Role-based access control (RBAC)
- Provider identity verification
"""
from typing import Optional
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid

try:
    from backend.database import Provider, get_db
    from backend.config import get_settings
except ModuleNotFoundError:
    from database import Provider, get_db
    from config import get_settings

settings = get_settings()

# Security schemes
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


class AuthUser:
    """Authenticated user context."""

    def __init__(self, provider_id: Optional[str] = None, role: str = "provider", is_admin: bool = False):
        self.provider_id = provider_id
        self.role = role
        self.is_admin = is_admin

    def can_access_provider(self, provider_id: str) -> bool:
        """Check if user can access data for a specific provider."""
        if self.is_admin:
            return True
        return str(self.provider_id) == str(provider_id)


async def get_current_user(
    api_key: Optional[str] = Security(api_key_header),
    bearer: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
    db: Session = Depends(get_db)
) -> AuthUser:
    """
    Get current authenticated user from API key or bearer token.

    Authentication methods supported:
    1. X-API-Key header (for provider access)
    2. Bearer token (for admin access)

    Raises:
        HTTPException: 401 if authentication fails
    """
    # Admin authentication via bearer token
    if bearer and bearer.credentials:
        # TODO: Implement proper JWT validation
        # For now, use a simple admin token from environment
        admin_token = getattr(settings, 'ADMIN_API_KEY', 'admin-secret-key')
        if bearer.credentials == admin_token:
            return AuthUser(role="admin", is_admin=True)

    # Provider authentication via API key
    if api_key:
        # API keys format: "provider_{provider_id}_{secret}"
        # For production, use proper API key management with hashing
        if api_key.startswith("provider_"):
            parts = api_key.split("_")
            if len(parts) >= 3:
                try:
                    provider_id = parts[1]

                    # Verify provider exists and is active
                    provider = db.query(Provider).filter(
                        Provider.id == uuid.UUID(provider_id),
                        Provider.is_active == True
                    ).first()

                    if provider:
                        return AuthUser(provider_id=str(provider.id), role="provider")
                except (ValueError, IndexError):
                    pass

    # No valid authentication provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )


async def get_current_admin(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """
    Dependency to require admin role.

    Raises:
        HTTPException: 403 if user is not an admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_provider(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Provider:
    """
    Dependency to require provider role and return Provider object.

    Raises:
        HTTPException: 403 if user is not a provider
    """
    if not current_user.provider_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider access required"
        )

    provider = db.query(Provider).filter(
        Provider.id == uuid.UUID(current_user.provider_id)
    ).first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )

    return provider


def verify_provider_access(
    current_user: AuthUser,
    provider_id: str,
    resource_name: str = "resource"
) -> None:
    """
    Verify that the current user has access to data for a specific provider.

    Args:
        current_user: Authenticated user
        provider_id: Target provider ID
        resource_name: Name of resource for error message

    Raises:
        HTTPException: 403 if access is denied
    """
    if not current_user.can_access_provider(provider_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You can only access your own {resource_name}"
        )


# Optional: API key generation utility
def generate_provider_api_key(provider_id: str) -> str:
    """
    Generate API key for a provider.

    Format: provider_{provider_id}_{random_secret}

    WARNING: In production, store hashed API keys in database
    and implement proper key management.
    """
    import secrets
    secret = secrets.token_urlsafe(32)
    return f"provider_{provider_id}_{secret}"
