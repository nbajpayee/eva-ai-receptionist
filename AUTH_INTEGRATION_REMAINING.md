# Authentication Integration - Backend Routes Update

## Status
✅ Auth module created (`backend/auth.py`)
✅ Auth dependencies imported in `main.py`
⚠️ **CRITICAL:** Admin routes need authentication added

## Routes RequiringAuthentication

### Settings Routes (All users can read, only owners can modify)
- ✅ `GET /api/admin/settings` - Add `user: User = Depends(get_current_user)`
- ✅ `PUT /api/admin/settings` - Add `user: User = Depends(require_owner)`

### Service Routes
- ✅ `GET /api/admin/services` - Add `user: User = Depends(get_current_user)`
- ✅ `GET /api/admin/services/{service_id}` - Add `user: User = Depends(get_current_user)`
- ✅ `POST /api/admin/services` - Add `user: User = Depends(require_owner)`
- ✅ `PUT /api/admin/services/{service_id}` - Add `user: User = Depends(require_owner)`
- ✅ `DELETE /api/admin/services/{service_id}` - Add `user: User = Depends(require_owner)`

### Provider Routes
- ✅ `GET /api/admin/providers` - Add `user: User = Depends(get_current_user)`
- ✅ `GET /api/admin/providers/{provider_id}` - Add `user: User = Depends(get_current_user)`
- ✅ `POST /api/admin/providers` - Add `user: User = Depends(require_owner)`
- ✅ `PUT /api/admin/providers/{provider_id}` - Add `user: User = Depends(require_owner)`
- ✅ `DELETE /api/admin/providers/{provider_id}` - Add `user: User = Depends(require_owner)`

### Location Routes
- ✅ `GET /api/admin/locations` - Add `user: User = Depends(get_current_user)`
- ✅ `GET /api/admin/locations/{location_id}` - Add `user: User = Depends(get_current_user)`
- ✅ `POST /api/admin/locations` - Add `user: User = Depends(require_owner)`
- ✅ `PUT /api/admin/locations/{location_id}` - Add `user: User = Depends(require_owner)`
- ✅ `PUT /api/admin/locations/{location_id}/hours` - Add `user: User = Depends(require_owner)`
- ✅ `DELETE /api/admin/locations/{location_id}` - Add `user: User = Depends(require_owner)`

### Metrics & Analytics Routes
- ✅ `GET /api/admin/metrics/overview` - **DONE**
- ✅ `GET /api/admin/calls` - **DONE**
- ✅ `GET /api/admin/calls/{call_id}` - **DONE**
- ⚠️ `GET /api/admin/calls/{call_id}/transcript` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/daily` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/timeseries` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/funnel` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/peak-hours` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/channel-distribution` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/analytics/outcome-distribution` - Add `user: User = Depends(get_current_user)`

### Customer Routes
- ⚠️ `GET /api/admin/customers` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/customers/{customer_id}/timeline` - Add `user: User = Depends(get_current_user)`

### Communication Routes
- ⚠️ `GET /api/admin/communications` - Add `user: User = Depends(get_current_user)`
- ⚠️ `GET /api/admin/communications/{conversation_id}` - Add `user: User = Depends(get_current_user)`

### Appointments Routes (need to find these)
- ⚠️ Check for any appointment admin routes

### Live Status Route
- ⚠️ Check for live status route

## Python Script to Add Authentication

Save as `backend/scripts/add_auth_to_routes.py`:

```python
#!/usr/bin/env python3
"""
Script to add authentication to all /api/admin/* routes in main.py
"""

import re

def add_auth_to_route(route_text, auth_type="get_current_user"):
    """Add authentication parameter to a route function."""
    # Find the function signature
    pattern = r'(async def \w+\([^)]*)(db: Session = Depends\(get_db\))'
    replacement = rf'\1\2,\n    user: User = Depends({auth_type})'

    # Handle case where db is last parameter
    if 'db: Session = Depends(get_db),' in route_text:
        route_text = route_text.replace(
            'db: Session = Depends(get_db),',
            f'db: Session = Depends(get_db),\n    user: User = Depends({auth_type}),'
        )
    elif 'db: Session = Depends(get_db)' in route_text:
        route_text = route_text.replace(
            'db: Session = Depends(get_db)',
            f'db: Session = Depends(get_db),\n    user: User = Depends({auth_type})'
        )

    return route_text

def main():
    # Read main.py
    with open('backend/main.py', 'r') as f:
        content = f.read()

    # Routes that need owner-only access (create/update/delete)
    owner_routes = [
        'POST /api/admin/settings',
        'PUT /api/admin/settings',
        'POST /api/admin/services',
        'PUT /api/admin/services',
        'DELETE /api/admin/services',
        'POST /api/admin/providers',
        'PUT /api/admin/providers',
        'DELETE /api/admin/providers',
        'POST /api/admin/locations',
        'PUT /api/admin/locations',
        'DELETE /api/admin/locations',
    ]

    # Add auth to all /api/admin/* routes
    # This is a placeholder - actual implementation would need careful regex

    print("Manual review required. Use Edit tool to update each route.")

if __name__ == '__main__':
    main()
```

## Manual Update Pattern

For each route, add the authentication parameter:

### Read-Only Routes (GET):
```python
# BEFORE:
@app.get("/api/admin/example")
async def example(db: Session = Depends(get_db)):
    ...

# AFTER:
@app.get("/api/admin/example")
async def example(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ...
```

### Owner-Only Routes (POST/PUT/DELETE):
```python
# BEFORE:
@app.delete("/api/admin/example/{id}")
async def delete_example(id: int, db: Session = Depends(get_db)):
    ...

# AFTER:
@app.delete("/api/admin/example/{id}")
async def delete_example(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_owner),
):
    ...
```

## Next Steps

1. ✅ Import auth dependencies (DONE)
2. ⚠️ Add auth to remaining routes (IN PROGRESS)
3. ⚠️ Test with Postman/curl
4. ⚠️ Update frontend to send JWT tokens
5. ⚠️ Deploy and test end-to-end

## Testing After Integration

```bash
# Test without auth (should return 401)
curl http://localhost:8000/api/admin/metrics/overview?period=today

# Test with auth (should return data)
# First, get token by logging in via frontend
# Then:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/admin/metrics/overview?period=today
```

## Estimated Remaining Work

- ~35-40 routes need authentication added
- Estimated time: 30-45 minutes of careful editing
- Risk: High (breaking existing functionality if not done correctly)

## Recommendation

Use a systematic approach:
1. Create backup: `cp backend/main.py backend/main.py.backup`
2. Update routes in batches (10 at a time)
3. Test after each batch
4. Commit incremental progress
