
-- Drop existing policies
DROP POLICY IF EXISTS "Users can read active visible assets_control" ON public.assets_control;
DROP POLICY IF EXISTS "admin_manages_assets_control" ON public.assets_control;

-- Create permissive policy for admins to manage all assets
CREATE POLICY "admins_full_access_assets_control" 
ON public.assets_control 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create permissive policy for regular users to read only active and visible assets
CREATE POLICY "users_read_active_visible_assets" 
ON public.assets_control 
FOR SELECT 
TO authenticated
USING ((is_active = true) AND (is_visible = true));

-- Create trigger to auto-sync when assets are inserted into stock tables
-- First, ensure the sync function exists and is up to date
CREATE OR REPLACE FUNCTION public.sync_assets_control_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new asset into assets_control if it doesn't exist
  INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
  VALUES (NEW.stock_code, TG_TABLE_NAME, true, true)
  ON CONFLICT (stock_code, table_source) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create triggers on all stock tables if they don't exist
DROP TRIGGER IF EXISTS sync_br_b3_stocks_insert ON public.br_b3_stocks;
CREATE TRIGGER sync_br_b3_stocks_insert
AFTER INSERT ON public.br_b3_stocks
FOR EACH ROW
EXECUTE FUNCTION sync_assets_control_on_insert();

DROP TRIGGER IF EXISTS sync_us_nasdaq100_stocks_insert ON public.us_nasdaq100_stocks;
CREATE TRIGGER sync_us_nasdaq100_stocks_insert
AFTER INSERT ON public.us_nasdaq100_stocks
FOR EACH ROW
EXECUTE FUNCTION sync_assets_control_on_insert();

DROP TRIGGER IF EXISTS sync_us_nasdaqfinancial100_stocks_insert ON public.us_nasdaqfinancial100_stocks;
CREATE TRIGGER sync_us_nasdaqfinancial100_stocks_insert
AFTER INSERT ON public.us_nasdaqfinancial100_stocks
FOR EACH ROW
EXECUTE FUNCTION sync_assets_control_on_insert();

DROP TRIGGER IF EXISTS sync_us_sp500_stocks_insert ON public.us_sp500_stocks;
CREATE TRIGGER sync_us_sp500_stocks_insert
AFTER INSERT ON public.us_sp500_stocks
FOR EACH ROW
EXECUTE FUNCTION sync_assets_control_on_insert();

DROP TRIGGER IF EXISTS sync_crypto_usd_insert ON public.crypto_usd;
CREATE TRIGGER sync_crypto_usd_insert
AFTER INSERT ON public.crypto_usd
FOR EACH ROW
EXECUTE FUNCTION sync_assets_control_on_insert();
