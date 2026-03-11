-- Fix search_path security warning for calculate_today_probability
CREATE OR REPLACE FUNCTION public.calculate_today_probability(
  p_asset_code TEXT,
  p_operation TEXT,
  p_reference_price TEXT,
  p_entry_percent NUMERIC,
  p_stop_percent NUMERIC,
  p_asset_class TEXT,
  p_exchange TEXT
)
RETURNS TABLE(
  probability_today TEXT,
  probability_raw NUMERIC,
  confidence_95 TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wins INT := 0;
  losses INT := 0;
  total INT := 0;
  alpha NUMERIC := 8;
  beta NUMERIC := 6;
  prob NUMERIC;
  lower NUMERIC;
  upper NUMERIC;
BEGIN
  -- Adjust prior based on market (calibrated 2025)
  alpha := 8; beta := 6; -- B3 default ~57%
  
  IF p_asset_class ILIKE 'crypto' THEN
    alpha := 7;  beta := 7;      -- 50%
  ELSIF p_exchange ILIKE '%nasdaq%' THEN
    alpha := 12; beta := 7;      -- 63.2%
  ELSIF p_exchange ILIKE '%nyse%' OR p_exchange ILIKE '%sp%' THEN
    alpha := 14; beta := 7;      -- 66.7%
  END IF;

  -- Get actual historical trades (last 18 months)
  SELECT
    COUNT(*) FILTER (WHERE outcome = 'win'),
    COUNT(*) FILTER (WHERE outcome = 'loss')
  INTO wins, losses
  FROM backtest_trades
  WHERE asset_code = p_asset_code
    AND operation = p_operation
    AND reference_price = p_reference_price
    AND ABS(entry_percent - p_entry_percent) <= 0.15
    AND ABS(stop_percent - p_stop_percent) <= 0.15
    AND trade_date >= CURRENT_DATE - INTERVAL '18 months';

  total := wins + losses;

  IF total < 15 THEN
    RETURN QUERY SELECT 'Insufficient'::TEXT, NULL::NUMERIC, ''::TEXT;
    RETURN;
  END IF;

  prob := ROUND(100.0 * (wins + alpha) / (total + alpha + beta), 1);
  lower := GREATEST(0,   ROUND(prob - 1.96 * SQRT(prob * (100 - prob) / total), 1));
  upper := LEAST(100,    ROUND(prob + 1.96 * SQRT(prob * (100 - prob) / total), 1));

  RETURN QUERY SELECT
    prob || '%',
    prob,
    '(' || lower || '% – ' || upper || '%)';
END;
$$;