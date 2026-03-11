
-- Função para sincronizar automaticamente assets_control quando um novo stock é inserido
CREATE OR REPLACE FUNCTION public.sync_assets_control_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insere o novo ativo em assets_control se não existir
  INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
  VALUES (NEW.stock_code, TG_TABLE_NAME, true, true)
  ON CONFLICT (stock_code, table_source) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Criar triggers para cada tabela de ativos

-- Trigger para br_b3_stocks
DROP TRIGGER IF EXISTS sync_assets_control_br_b3_stocks ON public.br_b3_stocks;
CREATE TRIGGER sync_assets_control_br_b3_stocks
AFTER INSERT ON public.br_b3_stocks
FOR EACH ROW
EXECUTE FUNCTION public.sync_assets_control_on_insert();

-- Trigger para us_nasdaq100_stocks
DROP TRIGGER IF EXISTS sync_assets_control_us_nasdaq100_stocks ON public.us_nasdaq100_stocks;
CREATE TRIGGER sync_assets_control_us_nasdaq100_stocks
AFTER INSERT ON public.us_nasdaq100_stocks
FOR EACH ROW
EXECUTE FUNCTION public.sync_assets_control_on_insert();

-- Trigger para us_nasdaqfinancial100_stocks
DROP TRIGGER IF EXISTS sync_assets_control_us_nasdaqfinancial100 ON public.us_nasdaqfinancial100_stocks;
CREATE TRIGGER sync_assets_control_us_nasdaqfinancial100
AFTER INSERT ON public.us_nasdaqfinancial100_stocks
FOR EACH ROW
EXECUTE FUNCTION public.sync_assets_control_on_insert();

-- Trigger para us_sp500_stocks
DROP TRIGGER IF EXISTS sync_assets_control_us_sp500_stocks ON public.us_sp500_stocks;
CREATE TRIGGER sync_assets_control_us_sp500_stocks
AFTER INSERT ON public.us_sp500_stocks
FOR EACH ROW
EXECUTE FUNCTION public.sync_assets_control_on_insert();

-- Trigger para crypto_usd
DROP TRIGGER IF EXISTS sync_assets_control_crypto_usd ON public.crypto_usd;
CREATE TRIGGER sync_assets_control_crypto_usd
AFTER INSERT ON public.crypto_usd
FOR EACH ROW
EXECUTE FUNCTION public.sync_assets_control_on_insert();

-- Agora, sincronizar os ativos que já existem mas não estão em assets_control

-- br_b3_stocks
INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
SELECT DISTINCT stock_code, 'br_b3_stocks', true, true
FROM public.br_b3_stocks
WHERE stock_code NOT IN (
  SELECT stock_code FROM public.assets_control WHERE table_source = 'br_b3_stocks'
)
ON CONFLICT (stock_code, table_source) DO NOTHING;

-- us_nasdaqfinancial100_stocks
INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
SELECT DISTINCT stock_code, 'us_nasdaqfinancial100_stocks', true, true
FROM public.us_nasdaqfinancial100_stocks
WHERE stock_code NOT IN (
  SELECT stock_code FROM public.assets_control WHERE table_source = 'us_nasdaqfinancial100_stocks'
)
ON CONFLICT (stock_code, table_source) DO NOTHING;

-- us_sp500_stocks
INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
SELECT DISTINCT stock_code, 'us_sp500_stocks', true, true
FROM public.us_sp500_stocks
WHERE stock_code NOT IN (
  SELECT stock_code FROM public.assets_control WHERE table_source = 'us_sp500_stocks'
)
ON CONFLICT (stock_code, table_source) DO NOTHING;

-- crypto_usd
INSERT INTO public.assets_control (stock_code, table_source, is_active, is_visible)
SELECT DISTINCT stock_code, 'crypto_usd', true, true
FROM public.crypto_usd
WHERE stock_code NOT IN (
  SELECT stock_code FROM public.assets_control WHERE table_source = 'crypto_usd'
)
ON CONFLICT (stock_code, table_source) DO NOTHING;
