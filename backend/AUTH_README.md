# Authentication & Authorization Documentation

## Overview

The Provider Analytics API now includes comprehensive authentication and authorization to protect sensitive provider data.

## Authentication Methods

### 1. Provider API Keys

**Format:** `provider_{provider_id}_{secret}`

**How to use:**
```bash
curl -H "X-API-Key: provider_123e4567-e89b-12d3-a456-426614174000_abc123..." \
  http://localhost:8000/api/consultations
```

**Access Level:**
- Providers can only access their own data
- Cannot access other providers' consultations, metrics, or insights

### 2. Admin Bearer Tokens

**Format:** `Bearer {admin_token}`

**How to use:**
```bash
curl -H "Authorization: Bearer admin-secret-key" \
  http://localhost:8000/api/providers/summary
```

**Access Level:**
- Full access to all provider data
- Can create new providers
- Can view all consultations and insights across all providers

## API Key Generation

To generate an API key for a provider:

```python
from auth import generate_provider_api_key

provider_id = "123e4567-e89b-12d3-a456-426614174000"
api_key = generate_provider_api_key(provider_id)
print(f"API Key: {api_key}")
```

**⚠️ IMPORTANT:** In production, API keys should be:
1. Stored hashed in the database
2. Generated using cryptographically secure random values
3. Rotatable by users
4. Logged when used (for security auditing)

## Protected Endpoints

### Consultation Endpoints (Provider-scoped)

- `POST /api/consultations` - Create consultation (provider can only create for themselves)
- `POST /api/consultations/{id}/upload-audio` - Upload audio (only for own consultations)
- `POST /api/consultations/{id}/end` - End consultation (only own consultations)
- `GET /api/consultations` - List consultations (automatically filtered to own consultations)

### Provider Endpoints

**Provider-scoped:**
- `GET /api/providers/{id}` - Get details (only own profile)
- `GET /api/providers/{id}/metrics` - Get metrics (only own metrics)
- `GET /api/providers/{id}/insights` - Get insights (only own insights)
- `GET /api/providers/{id}/consultations` - Get consultations (only own consultations)
- `GET /api/providers/summary` - Get summary (automatically filtered to self)

**Admin-only:**
- `POST /api/providers` - Create new provider

### Insights Endpoints

- `POST /api/insights/analyze/{consultation_id}` - Analyze consultation (only own consultations)
- `POST /api/insights/compare-providers` - Compare providers (admin or own comparison)
- `GET /api/insights/best-practices` - Get best practices (authenticated users)

## Role-Based Access Control (RBAC)

### Provider Role
```python
AuthUser(provider_id="abc123", role="provider", is_admin=False)
```

**Permissions:**
- ✅ Create own consultations
- ✅ Upload audio for own consultations
- ✅ View own metrics and insights
- ✅ End own consultations
- ❌ View other providers' data
- ❌ Create new providers
- ❌ Access admin endpoints

### Admin Role
```python
AuthUser(provider_id=None, role="admin", is_admin=True)
```

**Permissions:**
- ✅ View all provider data
- ✅ Create new providers
- ✅ Access all consultations
- ✅ Generate comparative insights
- ✅ View system-wide best practices

## Security Best Practices

### Current Implementation (Development)

✅ API key authentication
✅ Role-based access control
✅ Provider isolation (can't access other providers' data)
✅ Input validation via Pydantic models

### Production Requirements

Before deploying to production, implement:

1. **API Key Management**
   - Store hashed API keys in database
   - Implement key rotation
   - Add rate limiting per API key
   - Log all API key usage

2. **JWT Tokens**
   - Replace simple bearer token with proper JWT
   - Include expiration times
   - Implement refresh tokens
   - Add token revocation list

3. **HTTPS Only**
   - Enforce HTTPS in production
   - Use secure cookies for web sessions
   - Enable HSTS headers

4. **Audit Logging**
   - Log all authentication attempts
   - Log access to sensitive endpoints
   - Monitor for unusual access patterns
   - Set up alerts for failed auth attempts

5. **Additional Security Headers**
   ```python
   app.add_middleware(
       SecurityHeadersMiddleware,
       CSP="default-src 'self'",
       X_FRAME_OPTIONS="DENY",
       X_CONTENT_TYPE_OPTIONS="nosniff"
   )
   ```

## Environment Variables

Required for authentication:

```bash
# Admin access token (replace in production with proper JWT system)
ADMIN_API_KEY=your-secure-admin-token-here

# Database URL (for provider verification)
DATABASE_URL=postgresql://...
```

## Example Usage

### Provider accessing own consultations

```bash
# Get API key for provider
export PROVIDER_API_KEY="provider_abc123_secretkey"

# List own consultations
curl -H "X-API-Key: $PROVIDER_API_KEY" \
  http://localhost:8000/api/consultations

# Create consultation
curl -X POST \
  -H "X-API-Key: $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "abc123",
    "service_type": "Botox"
  }' \
  http://localhost:8000/api/consultations
```

### Admin accessing all data

```bash
# Admin bearer token
export ADMIN_TOKEN="admin-secret-key"

# Get all providers summary
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/providers/summary

# Create new provider
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Smith",
    "email": "smith@example.com",
    "specialties": ["Botox", "Fillers"]
  }' \
  http://localhost:8000/api/providers
```

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Invalid or missing authentication credentials"
}
```

Occurs when:
- No API key or bearer token provided
- Invalid API key format
- Provider not found or inactive
- Invalid bearer token

### 403 Forbidden
```json
{
  "detail": "Access denied: You can only access your own consultations"
}
```

Occurs when:
- Provider trying to access another provider's data
- Non-admin trying to access admin-only endpoint
- Provider trying to create provider (admin-only)

## Migration Guide

### For existing API consumers

If you were previously calling these endpoints without authentication:

1. **Obtain an API key** from your administrator
2. **Add the X-API-Key header** to all requests
3. **Update error handling** to handle 401/403 responses
4. **Test access** to ensure you can still access your data

### For administrators

1. **Generate API keys** for all existing providers
2. **Distribute keys securely** (email, password manager, etc.)
3. **Set ADMIN_API_KEY** environment variable
4. **Test admin access** with bearer token
5. **Monitor logs** for auth failures

## Future Enhancements

Planned authentication improvements:

- [ ] OAuth2 integration for third-party apps
- [ ] Multi-factor authentication (MFA)
- [ ] Single sign-on (SSO) via SAML
- [ ] API key scopes (read-only, read-write)
- [ ] Temporary access tokens
- [ ] Webhook authentication
- [ ] IP whitelisting
- [ ] Geographic restrictions

## Support

For authentication issues:
1. Check API key format
2. Verify provider is active in database
3. Check server logs for detailed error messages
4. Contact administrator for key reset
