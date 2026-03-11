-- Create table to track user queries/searches
CREATE TABLE IF NOT EXISTS public.user_query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_type text NOT NULL DEFAULT 'simulation',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster counting by user
CREATE INDEX idx_user_query_history_user_id ON public.user_query_history(user_id);

-- Enable RLS
ALTER TABLE public.user_query_history ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own queries
CREATE POLICY "Users can insert own queries"
ON public.user_query_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow admins to read all queries
CREATE POLICY "Admins can read all queries"
ON public.user_query_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND level_id >= 2
));

-- Function to record a user query
CREATE OR REPLACE FUNCTION public.record_user_query(p_query_type text DEFAULT 'simulation')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_query_history (user_id, query_type)
  VALUES (auth.uid(), p_query_type);
END;
$$;