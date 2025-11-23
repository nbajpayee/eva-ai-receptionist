# Row Level Security (RLS) Policy Guide

## Overview

This document explains the Row Level Security (RLS) policies implemented for the Eva AI Receptionist application. RLS ensures that users can only access and modify data they're authorized to see based on their role.

## User Roles

The application supports three user roles (defined in `user_role` enum):

1. **owner** - Full access to all data and settings
2. **provider** - Medical spa providers (limited management access)
3. **staff** - Front desk staff (read access + customer management)

## Policy Summary

### Customers Table

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT (view) | ✅ | ✅ | ✅ | All authenticated users can view |
| INSERT (create) | ✅ | ✅ | ✅ | All authenticated users can create |
| UPDATE (edit) | ✅ | ✅ | ✅ | All authenticated users can edit |
| DELETE (remove) | ✅ | ❌ | ❌ | Only owners (GDPR compliance) |

### Appointments Table

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ | ✅ | All authenticated users can view |
| INSERT | ✅ | ✅ | ✅ | Staff and above can create |
| UPDATE | ✅ | ✅ | ✅ | Staff and above can edit |
| DELETE | ✅ | ❌ | ❌ | Only owners |

### Call Sessions / Conversations

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ | ✅ | All authenticated users can view |
| INSERT | ✅ | ❌ | ❌ | Only system/owner can create |
| UPDATE | ✅ | ✅ | ✅ | Staff and above can update (add notes) |
| DELETE | ✅ | ❌ | ❌ | Only owners |

### Services Table

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ | ✅ | All authenticated users can view |
| INSERT | ✅ | ❌ | ❌ | Only owners can manage |
| UPDATE | ✅ | ❌ | ❌ | Only owners can manage |
| DELETE | ✅ | ❌ | ❌ | Only owners can manage |

### Providers Table

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ (own) | ✅ | Providers can view own profile |
| INSERT | ✅ | ❌ | ❌ | Only owners can manage |
| UPDATE | ✅ | ❌ | ❌ | Only owners can manage |
| DELETE | ✅ | ❌ | ❌ | Only owners can manage |

### Locations & Business Hours

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ | ✅ | All authenticated users can view |
| INSERT | ✅ | ❌ | ❌ | Only owners can manage |
| UPDATE | ✅ | ❌ | ❌ | Only owners can manage |
| DELETE | ✅ | ❌ | ❌ | Only owners can manage |

### Settings (med_spa_settings)

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ | ✅ | ✅ | All authenticated users can view |
| UPDATE | ✅ | ❌ | ❌ | Only owners can update |

### Profiles

| Operation | Owner | Provider | Staff | Notes |
|-----------|-------|----------|-------|-------|
| SELECT | ✅ (all) | ✅ (own) | ✅ (own) | Users see own profile, owners see all |
| INSERT | ✅ | ❌ | ❌ | Only owners can create users |
| UPDATE | ✅ (all) | ✅ (own) | ✅ (own) | Users can update own profile (except role) |
| DELETE | ✅ | ❌ | ❌ | Only owners can delete users |

## Security Features

### 1. Role-Based Access Control (RBAC)

All policies check the user's role from the `profiles` table:

```sql
EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner'
)
```

### 2. Service Role Restrictions

System operations (like creating call sessions from the voice interface) use the `service_role`:

```sql
auth.role() = 'service_role'
```

This ensures that automated systems can write data, but regular users cannot create call sessions manually.

### 3. Audit Logging

The `audit_log` table tracks sensitive operations:

- Who performed the operation (`user_id`)
- What table was affected (`table_name`)
- What type of operation (`operation`: INSERT, UPDATE, DELETE)
- Previous and new data (`old_data`, `new_data`)
- When it occurred (`created_at`)

Only owners can view audit logs.

### 4. Helper Functions

Two helper functions simplify policy checks:

- `has_role(required_role)` - Check if user has specific role
- `has_any_role(required_roles[])` - Check if user has any of the roles

Example usage:

```sql
CREATE POLICY "Staff and above can create"
    ON some_table
    FOR INSERT
    WITH CHECK (has_any_role(ARRAY['staff', 'provider', 'owner']::user_role[]));
```

## Implementation Steps

### Initial Setup

1. Run `create_auth_schema.sql` first (creates profiles, roles, and basic RLS)
2. Create at least one owner user in Supabase Auth
3. Verify the owner user has a profile with `role = 'owner'`

### Enhanced Security

1. Run `enhanced_rls_policies.sql` to upgrade policies
2. Verify RLS is enabled on all tables (script includes verification)
3. Test with different user roles

### Verification

```sql
-- Check RLS is enabled
SELECT tablename, relrowsecurity
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public';

-- Should all show 't' (true) for relrowsecurity

-- List all policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

## Testing RLS Policies

### Test as Staff User

```sql
-- Set user context (replace with actual staff user ID)
SET SESSION "request.jwt.claims" = '{"sub": "staff-user-uuid", "role": "authenticated"}';

-- Try operations
SELECT * FROM customers; -- Should work
INSERT INTO customers (...) VALUES (...); -- Should work
UPDATE customers SET ... WHERE id = 1; -- Should work
DELETE FROM customers WHERE id = 1; -- Should fail
```

### Test as Owner

```sql
-- Set user context (replace with actual owner user ID)
SET SESSION "request.jwt.claims" = '{"sub": "owner-user-uuid", "role": "authenticated"}';

-- Try operations
DELETE FROM customers WHERE id = 1; -- Should work
UPDATE med_spa_settings SET ... WHERE id = 1; -- Should work
```

## Common Issues

### Issue: "new row violates row-level security policy"

**Cause**: User doesn't have permission for the operation.

**Solution**: Check the user's role in the `profiles` table and ensure the policy allows that role.

### Issue: Policies not working after migration

**Cause**: RLS might not be enabled on the table.

**Solution**:
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

### Issue: Service role operations failing

**Cause**: Backend might be using wrong credentials.

**Solution**: Ensure backend uses `SUPABASE_SERVICE_ROLE_KEY` for system operations, not `SUPABASE_ANON_KEY`.

## Best Practices

1. **Always enable RLS** on tables containing user data
2. **Test policies** with different roles before deploying
3. **Use service role sparingly** - only for system operations
4. **Log sensitive operations** using audit_log
5. **Review policies regularly** as requirements change
6. **Don't bypass RLS** in application code - let Supabase enforce it
7. **Use helper functions** for complex role checks
8. **Document exceptions** if you need to allow broader access

## HIPAA Compliance Notes

For HIPAA compliance, consider:

1. **Audit Logging**: Enable for all PHI access (already implemented)
2. **Encryption**: Supabase encrypts data at rest and in transit
3. **Access Controls**: RLS provides required access controls
4. **Minimum Necessary**: Staff should only see data needed for their role
5. **BAA**: Ensure Business Associate Agreement with Supabase

Additional recommendations:
- Enable automatic data export for backup
- Set up automated audit log review
- Implement data retention policies
- Add encryption for sensitive fields (e.g., medical notes)

## Maintenance

### Adding New Tables

When adding new tables:

1. Enable RLS immediately:
```sql
CREATE TABLE new_table (...);
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```

2. Create appropriate policies:
```sql
-- Example: Read for all, write for owners
CREATE POLICY "All can view" ON new_table
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage" ON new_table
    FOR ALL USING (has_role('owner'::user_role));
```

3. Update this documentation

### Reviewing Policies

Quarterly review checklist:
- [ ] All tables have RLS enabled
- [ ] No overly permissive policies
- [ ] Audit logs are being captured
- [ ] No unused policies
- [ ] Policies match current business rules
- [ ] Test with each role type

## Support

For questions or issues:
1. Check Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
2. Review policy syntax in PostgreSQL docs
3. Test in development environment first
4. Consult with security team for sensitive changes
