-- Fix search_path security issues in SQL functions

-- Fix table_exists function
CREATE OR REPLACE FUNCTION public.table_exists(p_table_name text)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name
  );
END;
$$;

-- Fix get_unique_stock_codes function
CREATE OR REPLACE FUNCTION public.get_unique_stock_codes(p_table_name text)
RETURNS SETOF text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_text text;
  result_row text;
BEGIN
  -- Validate the table exists to prevent SQL injection
  IF NOT (SELECT table_exists(p_table_name)) THEN
    RAISE EXCEPTION 'Table % does not exist', p_table_name;
  END IF;
  
  -- Dynamic SQL to get unique stock codes
  query_text := format('SELECT DISTINCT stock_code FROM %I ORDER BY stock_code', p_table_name);
  
  -- Execute the query and return results
  FOR result_row IN EXECUTE query_text
  LOOP
    RETURN NEXT result_row;
  END LOOP;
  
  RETURN;
END;
$$;

-- Fix get_stock_data function
CREATE OR REPLACE FUNCTION public.get_stock_data(p_table_name text, p_stock_code_param text, p_limit_rows int DEFAULT 300)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_text text;
  result_json json;
BEGIN
  -- Validate the table exists to prevent SQL injection
  IF NOT (SELECT table_exists(p_table_name)) THEN
    RAISE EXCEPTION 'Table % does not exist', p_table_name;
  END IF;
  
  -- Dynamic SQL to get stock data
  query_text := format('
    SELECT json_agg(t) 
    FROM (
      SELECT * FROM %I 
      WHERE stock_code = $1 
      ORDER BY date DESC 
      LIMIT $2
    ) t', p_table_name);
  
  -- Execute the query
  EXECUTE query_text INTO result_json USING p_stock_code_param, p_limit_rows;
  
  -- Return empty array if null
  IF result_json IS NULL THEN
    result_json := '[]'::json;
  END IF;
  
  RETURN result_json;
END;
$$;

-- Fix handle_auth_user_confirmation trigger function
CREATE OR REPLACE FUNCTION public.handle_auth_user_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If email_confirmed_at is set and not null, update status_users to 'active'
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) THEN
    
    UPDATE public.users
    SET status_users = 'active', email_verified = true, updated_at = now()
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix handle_new_user trigger function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set default values for new users
  NEW.level_id := COALESCE(NEW.level_id, 1);
  NEW.status_users := COALESCE(NEW.status_users, 'pending');
  
  RETURN NEW;
END;
$$;

-- Fix check_user_by_email function
CREATE OR REPLACE FUNCTION public.check_user_by_email(p_email text)
RETURNS TABLE (
    user_exists boolean,
    status_users text,
    level_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 as user_exists,
        COALESCE(u.status_users, 'pending') as status_users,
        COALESCE(u.level_id, 1) as level_id
    FROM public.users u
    WHERE u.email = p_email
    GROUP BY u.status_users, u.level_id;
END;
$$;