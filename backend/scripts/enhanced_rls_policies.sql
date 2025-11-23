-- Enhanced RLS Policies for Production Readiness
-- This script creates more granular RLS policies based on user roles
-- Run this AFTER create_auth_schema.sql

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can manage appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can view call sessions" ON call_sessions;
DROP POLICY IF EXISTS "Authenticated users can manage call sessions" ON call_sessions;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can manage conversations" ON conversations;

-- ============================================================================
-- CUSTOMERS TABLE - Enhanced Policies
-- ============================================================================

-- All authenticated users can view customers (read-only for staff)
CREATE POLICY "All authenticated users can view customers"
    ON customers
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Staff and above can create customers
CREATE POLICY "Staff and above can create customers"
    ON customers
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Staff and above can update customers
CREATE POLICY "Staff and above can update customers"
    ON customers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Only owners can delete customers (GDPR compliance)
-- Keep the existing policy
-- CREATE POLICY "Only owners can delete customers" ON customers FOR DELETE ...

-- ============================================================================
-- APPOINTMENTS TABLE - Enhanced Policies
-- ============================================================================

-- All authenticated users can view appointments
CREATE POLICY "All authenticated users can view appointments"
    ON appointments
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Staff and above can create appointments
CREATE POLICY "Staff and above can create appointments"
    ON appointments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Staff and above can update appointments
CREATE POLICY "Staff and above can update appointments"
    ON appointments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Only owners can delete appointments
CREATE POLICY "Only owners can delete appointments"
    ON appointments
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'owner'
        )
    );

-- ============================================================================
-- CALL SESSIONS TABLE - Enhanced Policies
-- ============================================================================

-- All authenticated users can view call sessions
CREATE POLICY "All authenticated users can view call sessions"
    ON call_sessions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- System (service role) can create call sessions
-- Staff cannot create call sessions manually
CREATE POLICY "System can create call sessions"
    ON call_sessions
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'owner'
        )
    );

-- Staff and above can update call sessions (e.g., add notes)
CREATE POLICY "Staff and above can update call sessions"
    ON call_sessions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Only owners can delete call sessions
CREATE POLICY "Only owners can delete call sessions"
    ON call_sessions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'owner'
        )
    );

-- ============================================================================
-- CONVERSATIONS TABLE - Enhanced Policies
-- ============================================================================

-- All authenticated users can view conversations
CREATE POLICY "All authenticated users can view conversations"
    ON conversations
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- System (service role) can create conversations
CREATE POLICY "System can create conversations"
    ON conversations
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'owner'
        )
    );

-- Staff and above can update conversations
CREATE POLICY "Staff and above can update conversations"
    ON conversations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('staff', 'provider', 'owner')
        )
    );

-- Only owners can delete conversations
CREATE POLICY "Only owners can delete conversations"
    ON conversations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'owner'
        )
    );

-- ============================================================================
-- ADDITIONAL TABLES (if they exist)
-- ============================================================================

-- Enable RLS on other tables if they exist
DO $$
BEGIN
    -- Services table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'services') THEN
        ALTER TABLE services ENABLE ROW LEVEL SECURITY;

        -- All can view services
        CREATE POLICY IF NOT EXISTS "All authenticated users can view services"
            ON services FOR SELECT
            USING (auth.role() = 'authenticated');

        -- Only owners can manage services
        CREATE POLICY IF NOT EXISTS "Owners can manage services"
            ON services FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'owner'
                )
            );
    END IF;

    -- Providers table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'providers') THEN
        ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

        -- All can view providers
        CREATE POLICY IF NOT EXISTS "All authenticated users can view providers"
            ON providers FOR SELECT
            USING (auth.role() = 'authenticated');

        -- Providers can view their own profile
        CREATE POLICY IF NOT EXISTS "Providers can view own profile"
            ON providers FOR SELECT
            USING (
                email IN (
                    SELECT email FROM profiles WHERE id = auth.uid()
                )
            );

        -- Only owners can manage providers
        CREATE POLICY IF NOT EXISTS "Owners can manage providers"
            ON providers FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'owner'
                )
            );
    END IF;

    -- Locations table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'locations') THEN
        ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

        -- All can view locations
        CREATE POLICY IF NOT EXISTS "All authenticated users can view locations"
            ON locations FOR SELECT
            USING (auth.role() = 'authenticated');

        -- Only owners can manage locations
        CREATE POLICY IF NOT EXISTS "Owners can manage locations"
            ON locations FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'owner'
                )
            );
    END IF;

    -- Business hours table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'business_hours') THEN
        ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

        -- All can view business hours
        CREATE POLICY IF NOT EXISTS "All authenticated users can view business hours"
            ON business_hours FOR SELECT
            USING (auth.role() = 'authenticated');

        -- Only owners can manage business hours
        CREATE POLICY IF NOT EXISTS "Owners can manage business hours"
            ON business_hours FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'owner'
                )
            );
    END IF;

    -- Settings table
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'med_spa_settings') THEN
        ALTER TABLE med_spa_settings ENABLE ROW LEVEL SECURITY;

        -- All can view settings
        CREATE POLICY IF NOT EXISTS "All authenticated users can view settings"
            ON med_spa_settings FOR SELECT
            USING (auth.role() = 'authenticated');

        -- Only owners can update settings
        CREATE POLICY IF NOT EXISTS "Owners can update settings"
            ON med_spa_settings FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'owner'
                )
            );
    END IF;
END $$;

-- ============================================================================
-- AUDIT LOGGING (Optional - for compliance)
-- ============================================================================

-- Create audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs
CREATE POLICY "Only owners can view audit logs"
    ON audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
    ON audit_log
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION has_any_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = ANY(required_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION has_role TO authenticated;
GRANT EXECUTE ON FUNCTION has_any_role TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    RAISE NOTICE 'Checking RLS status for all tables...';

    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    LOOP
        RAISE NOTICE 'Table: % - RLS: %',
            table_record.tablename,
            (SELECT relrowsecurity FROM pg_class WHERE relname = table_record.tablename);
    END LOOP;
END $$;
