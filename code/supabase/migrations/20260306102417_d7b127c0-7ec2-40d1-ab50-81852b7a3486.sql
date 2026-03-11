
-- Attach the existing handle_new_auth_user function as a trigger on auth.users
-- This ensures new OAuth users are automatically created in public.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Also improve the function to properly handle Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_locale text;
  v_name text;
  v_lead_source text;
BEGIN
    -- Extract name from metadata (Google sends it in different fields)
    v_name := COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    );

    -- Detect locale from metadata or default to pt-BR
    v_locale := COALESCE(
      NEW.raw_user_meta_data ->> 'locale',
      'pt-BR'
    );

    -- Detect lead source based on provider
    v_lead_source := CASE
      WHEN NEW.raw_app_meta_data ->> 'provider' = 'google' THEN 'google_oauth'
      ELSE 'website'
    END;

    -- Insert into public.users when a new auth user is created
    INSERT INTO public.users (
        id,
        email,
        name,
        level_id,
        status_users,
        subscription_tier,
        email_verified,
        locale,
        email_subscribed,
        has_seen_tour,
        lead_source,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_name,
        1,
        CASE
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'
            ELSE 'pending'
        END,
        'Free',
        (NEW.email_confirmed_at IS NOT NULL),
        v_locale,
        true,
        false,
        v_lead_source,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        status_users = CASE
            WHEN NEW.email_confirmed_at IS NOT NULL AND public.users.status_users = 'pending' THEN 'active'
            ELSE public.users.status_users
        END,
        email_verified = CASE
            WHEN NEW.email_confirmed_at IS NOT NULL THEN true
            ELSE public.users.email_verified
        END,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_auth_user: %', SQLERRM;
        RETURN NEW;
END;
$$;
