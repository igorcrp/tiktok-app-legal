-- Enable REPLICA IDENTITY FULL for realtime subscriptions
ALTER TABLE public.assets_control REPLICA IDENTITY FULL;
ALTER TABLE public.market_data_sources REPLICA IDENTITY FULL;
ALTER TABLE public.br_b3_stocks REPLICA IDENTITY FULL;
ALTER TABLE public.us_nasdaq100_stocks REPLICA IDENTITY FULL;
ALTER TABLE public.us_nasdaqfinancial100_stocks REPLICA IDENTITY FULL;
ALTER TABLE public.us_sp500_stocks REPLICA IDENTITY FULL;
ALTER TABLE public.crypto_usd REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication for realtime functionality
-- First, check if publication exists and add tables
DO $$
BEGIN
  -- Add assets_control to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'assets_control'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets_control;
  END IF;
  
  -- Add market_data_sources to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'market_data_sources'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.market_data_sources;
  END IF;
  
  -- Add br_b3_stocks to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'br_b3_stocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.br_b3_stocks;
  END IF;
  
  -- Add us_nasdaq100_stocks to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'us_nasdaq100_stocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.us_nasdaq100_stocks;
  END IF;
  
  -- Add us_nasdaqfinancial100_stocks to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'us_nasdaqfinancial100_stocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.us_nasdaqfinancial100_stocks;
  END IF;
  
  -- Add us_sp500_stocks to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'us_sp500_stocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.us_sp500_stocks;
  END IF;
  
  -- Add crypto_usd to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'crypto_usd'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crypto_usd;
  END IF;
END $$;