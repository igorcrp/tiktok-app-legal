-- Fix remaining search_path security issues in trigger functions

-- Fix audit_payment_data_access trigger function
CREATE OR REPLACE FUNCTION public.audit_payment_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when sensitive fields are being accessed by non-admin users
  IF TG_OP = 'UPDATE' AND NOT is_admin() THEN
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id OR
       OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier OR
       OLD.subscribed IS DISTINCT FROM NEW.subscribed THEN
      INSERT INTO public.audit_log (
        table_name,
        operation,
        user_id,
        old_values,
        new_values
      ) VALUES (
        'users',
        'UNAUTHORIZED_PAYMENT_MODIFICATION_ATTEMPT',
        auth.uid(),
        json_build_object('stripe_customer_id', 'REDACTED', 'subscription_tier', OLD.subscription_tier),
        json_build_object('stripe_customer_id', 'REDACTED', 'subscription_tier', NEW.subscription_tier)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix audit_sensitive_changes trigger function
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log changes to level_id or subscription_tier
  IF TG_OP = 'UPDATE' AND (OLD.level_id != NEW.level_id OR OLD.subscription_tier != NEW.subscription_tier) THEN
    INSERT INTO public.audit_log (
      table_name,
      operation,
      user_id,
      old_values,
      new_values
    ) VALUES (
      'users',
      'PRIVILEGE_CHANGE',
      auth.uid(),
      json_build_object('level_id', OLD.level_id, 'subscription_tier', OLD.subscription_tier),
      json_build_object('level_id', NEW.level_id, 'subscription_tier', NEW.subscription_tier)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix prevent_privilege_escalation trigger function
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role or any context without an authenticated user to proceed
  -- Edge Functions using the service role key have no auth context (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If a regular authenticated user tries to change privileged fields, enforce admin-only
  IF (OLD.level_id IS DISTINCT FROM NEW.level_id)
     OR (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
     OR (OLD.subscribed IS DISTINCT FROM NEW.subscribed)
     OR (OLD.subscription_end IS DISTINCT FROM NEW.subscription_end) THEN

    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND level_id >= 2
    ) THEN
      RAISE EXCEPTION 'Only administrators can modify user levels and subscription tiers';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;