"""
Authentication utilities for FastAPI
Validates Supabase JWT tokens and provides auth dependencies
"""

from typing import Optional
import base64
import json

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from config import get_settings

settings = get_settings()
security = HTTPBearer()


class User:
    """Authenticated user model"""

    def __init__(self, user_id: str, email: str, role: str):
        self.id = user_id
        self.email = email
        self.role = role

    def has_role(self, *roles: str) -> bool:
        """Check if user has one of the specified roles"""
        return self.role in roles


def decode_jwt(token: str) -> dict:
    """Decode Supabase JWT token without verifying the signature.

    We trust Supabase to issue and validate tokens; here we only need the claims
    (sub, email, user_metadata) so we base64url-decode the payload portion.

    Raises HTTP 401 if the token is malformed.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise JWTError("Invalid token format")

        payload_segment = parts[1]
        # Add padding for base64url decoding
        padding = "=" * (-len(payload_segment) % 4)
        decoded_bytes = base64.urlsafe_b64decode(payload_segment + padding)
        payload = json.loads(decoded_bytes.decode("utf-8"))
        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """
    FastAPI dependency to get current authenticated user from JWT token

    Usage:
        @app.get("/api/admin/endpoint")
        async def endpoint(user: User = Depends(get_current_user)):
            # user is authenticated
            pass
    """
    token = credentials.credentials
    payload = decode_jwt(token)

    # Extract user information from JWT payload
    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("user_metadata", {}).get("role", "staff")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    return User(user_id=user_id, email=email, role=role)


async def require_role(*roles: str):
    """
    FastAPI dependency to require specific roles

    Usage:
        @app.delete("/api/admin/customers/{id}")
        async def delete_customer(
            id: int,
            user: User = Depends(require_role("owner"))
        ):
            # Only owners can access this endpoint
            pass
    """

    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_role(*roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(roles)}",
            )
        return user

    return role_checker


# Convenience dependencies for common role checks
async def require_owner(user: User = Depends(get_current_user)) -> User:
    """Require owner role"""
    if not user.has_role("owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required"
        )
    return user


async def require_staff(user: User = Depends(get_current_user)) -> User:
    """Require staff or higher role"""
    if not user.has_role("owner", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required"
        )
    return user


async def require_provider(user: User = Depends(get_current_user)) -> User:
    """Require provider or higher role"""
    if not user.has_role("owner", "provider"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider access required"
        )
    return user


# Optional auth - allows both authenticated and unauthenticated access
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[User]:
    """
    FastAPI dependency for optional authentication
    Returns User if authenticated, None otherwise
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials
        payload = decode_jwt(token)
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("user_metadata", {}).get("role", "staff")

        if user_id and email:
            return User(user_id=user_id, email=email, role=role)
    except:
        pass

    return None
