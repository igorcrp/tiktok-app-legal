-- Create function to UPSERT backtest stats (increment wins/losses)
CREATE OR REPLACE FUNCTION upsert_backtest_stats(
  p_asset_code TEXT,
  p_operation TEXT,
  p_reference_price TEXT,
  p_entry_percent NUMERIC,
  p_stop_percent NUMERIC,
  p_asset_class TEXT,
  p_exchange TEXT,
  p_wins INTEGER,
  p_losses INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO backtest_stats (
    asset_code,
    operation,
    reference_price,
    entry_percent,
    stop_percent,
    asset_class,
    exchange,
    wins,
    losses,
    last_updated
  )
  VALUES (
    p_asset_code,
    p_operation,
    p_reference_price,
    p_entry_percent,
    p_stop_percent,
    p_asset_class,
    p_exchange,
    p_wins,
    p_losses,
    CURRENT_DATE
  )
  ON CONFLICT (asset_code, operation, reference_price, entry_percent, stop_percent)
  DO UPDATE SET
    wins = backtest_stats.wins + EXCLUDED.wins,
    losses = backtest_stats.losses + EXCLUDED.losses,
    last_updated = CURRENT_DATE;
END;
$$;