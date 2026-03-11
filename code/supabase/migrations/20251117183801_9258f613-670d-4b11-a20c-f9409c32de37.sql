-- Create backtest_trades table to store historical trade data
CREATE TABLE IF NOT EXISTS public.backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL,
  operation TEXT NOT NULL,
  country TEXT NOT NULL,
  exchange TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  reference_price TEXT NOT NULL,
  entry_percent NUMERIC NOT NULL,
  stop_percent NUMERIC NOT NULL,
  period TEXT NOT NULL,
  trade_date DATE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss')),
  profit_percent NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_backtest_trades_lookup ON public.backtest_trades (
  asset_code, operation, reference_price, trade_date DESC
);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_date ON public.backtest_trades (trade_date DESC);

-- Enable RLS
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read backtest trades"
ON public.backtest_trades FOR SELECT
TO authenticated
USING (true);

-- Allow system to insert trades (for analysis results)
CREATE POLICY "System can insert backtest trades"
ON public.backtest_trades FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update the calculate_today_probability function
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
    AND ABS(entry_percent - p_entry_percent) <= 0.15   -- tolerance
    AND ABS(stop_percent - p_stop_percent) <= 0.15
    AND trade_date >= CURRENT_DATE - INTERVAL '18 months';

  total := wins + losses;

  -- Need at least 15 trades for reliable estimate
  IF total < 15 THEN
    RETURN QUERY SELECT 'Insufficient'::TEXT, NULL::NUMERIC, ''::TEXT;
    RETURN;
  END IF;

  -- Bayesian MAP estimate
  prob := ROUND(100.0 * (wins + alpha) / (total + alpha + beta), 1);

  -- 95% credible interval (normal approximation)
  lower := GREATEST(0,   ROUND(prob - 1.96 * SQRT(prob * (100 - prob) / total), 1));
  upper := LEAST(100,    ROUND(prob + 1.96 * SQRT(prob * (100 - prob) / total), 1));

  RETURN QUERY SELECT
    prob || '%',
    prob,
    '(' || lower || '% – ' || upper || '%)';
END;
$$;