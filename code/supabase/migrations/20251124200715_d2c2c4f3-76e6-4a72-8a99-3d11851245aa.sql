-- Remove problematic trigger that causes user creation to fail
DROP TRIGGER IF EXISTS trigger_auto_create_stripe_customer ON public.users;
DROP FUNCTION IF EXISTS public.auto_create_stripe_customer();

-- The admin-create-user edge function already handles Stripe customer creation manually
-- So this trigger is not needed and was causing database errors