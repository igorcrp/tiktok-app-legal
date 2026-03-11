-- Update calculate_today_probability to return "-" instead of "Insufficient" and single confidence value
CREATE OR REPLACE FUNCTION calculate_today_probability(
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
  v_wins INTEGER := 0;
  v_losses INTEGER := 0;
  v_total INTEGER := 0;
  v_alpha NUMERIC := 8;
  v_beta NUMERIC := 6;
  v_prob NUMERIC;
  v_lower NUMERIC;
  v_upper NUMERIC;
  v_se NUMERIC;
  v_confidence NUMERIC;
BEGIN
  -- Set prior based on market
  IF p_asset_class ILIKE 'crypto' THEN
    v_alpha := 7;
    v_beta := 7;  -- 50%
  ELSIF p_exchange ILIKE '%nasdaq%' THEN
    v_alpha := 12;
    v_beta := 7;  -- 63.2%
  ELSIF p_exchange ILIKE '%nyse%' OR p_exchange ILIKE '%sp%' OR p_exchange ILIKE '%s&p%' THEN
    v_alpha := 14;
    v_beta := 7;  -- 66.7%
  ELSE
    v_alpha := 8;
    v_beta := 6;  -- ~57%
  END IF;

  -- Get aggregated stats with tolerance ±0.15 on percentages
  SELECT 
    COALESCE(SUM(wins), 0),
    COALESCE(SUM(losses), 0)
  INTO v_wins, v_losses
  FROM backtest_stats
  WHERE asset_code = p_asset_code
    AND operation = p_operation
    AND reference_price = p_reference_price
    AND ABS(entry_percent - p_entry_percent) <= 0.15
    AND ABS(stop_percent - p_stop_percent) <= 0.15;

  v_total := v_wins + v_losses;

  -- Need at least 18 data points - return "-" instead of "Insufficient"
  IF v_total < 18 THEN
    RETURN QUERY SELECT '-'::TEXT, NULL::NUMERIC, '-'::TEXT;
    RETURN;
  END IF;

  -- Calculate Bayesian probability
  v_prob := ROUND(100.0 * (v_wins + v_alpha) / (v_total + v_alpha + v_beta), 1);
  
  -- Calculate 95% confidence interval using normal approximation
  v_se := SQRT(v_prob * (100 - v_prob) / v_total);
  v_lower := GREATEST(0, ROUND(v_prob - 1.96 * v_se, 1));
  v_upper := LEAST(100, ROUND(v_prob + 1.96 * v_se, 1));
  
  -- Calculate single confidence value (midpoint of confidence interval)
  v_confidence := ROUND((v_lower + v_upper) / 2, 1);

  RETURN QUERY SELECT
    v_prob || '%',
    v_prob,
    v_confidence || '%';
END;
$$;