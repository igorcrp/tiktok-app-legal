-- Drop existing trigger if exists to recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function to handle new auth users with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert into public.users when a new auth user is created
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        level_id, 
        status_users, 
        subscription_tier, 
        email_verified,
        created_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
        1,
        CASE 
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'
            ELSE 'pending'
        END,
        'Free',
        (NEW.email_confirmed_at IS NOT NULL),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        status_users = CASE 
            WHEN NEW.email_confirmed_at IS NOT NULL AND public.users.status_users = 'pending' THEN 'active'
            ELSE public.users.status_users
        END,
        email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        RAISE WARNING 'Error in handle_new_auth_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Create trigger on auth.users to automatically sync with public.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Also ensure updates to auth.users (like email confirmation) sync to public.users
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (
        OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at OR
        OLD.email IS DISTINCT FROM NEW.email
    )
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;