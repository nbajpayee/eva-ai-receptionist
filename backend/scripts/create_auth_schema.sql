-- Authentication Schema for Admin Dashboard
-- This script creates the necessary tables and RLS policies for Supabase Auth

-- Create user roles enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'staff', 'provider');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Create policy: Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Create policy: Only owners can view all profiles
CREATE POLICY "Owners can view all profiles"
    ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Create policy: Only owners can insert new profiles
CREATE POLICY "Owners can insert profiles"
    ON profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Create policy: Only owners can update any profile
CREATE POLICY "Owners can update any profile"
    ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Create policy: Only owners can delete profiles
CREATE POLICY "Owners can delete profiles"
    ON profiles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Enable RLS on existing tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Customers table policies
CREATE POLICY "Authenticated users can view customers"
    ON customers
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert customers"
    ON customers
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update customers"
    ON customers
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Only owners can delete customers"
    ON customers
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Appointments table policies
CREATE POLICY "Authenticated users can view appointments"
    ON appointments
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage appointments"
    ON appointments
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Call sessions table policies
CREATE POLICY "Authenticated users can view call sessions"
    ON call_sessions
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage call sessions"
    ON call_sessions
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Conversations table policies
CREATE POLICY "Authenticated users can view conversations"
    ON conversations
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage conversations"
    ON conversations
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Insert a default owner user (you should update this after running)
-- Note: This requires you to have already created a user in Supabase Auth
-- IMPORTANT: Replace 'your-user-id-here' with actual user ID from auth.users
-- Example query to get user IDs: SELECT id, email FROM auth.users;

-- Uncomment and update the following line with your actual user ID:
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES (
--     'your-user-id-here',
--     'admin@example.com',
--     'Admin User',
--     'owner'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'owner';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.call_sessions TO authenticated;
GRANT ALL ON public.conversations TO authenticated;
