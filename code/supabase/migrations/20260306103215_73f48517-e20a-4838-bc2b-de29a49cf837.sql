-- Fix missing public.users record for OAuth user joaosaralho@gmail.com
-- Their auth.users entry exists (id: 03822091-dea0-4104-808b-a7d73c2725a7) but public.users is missing
INSERT INTO public.users (
  id,
  email,
  name,
  level_id,
  status_users,
  email_verified,
  subscription_tier,
  locale,
  email_subscribed,
  has_seen_tour,
  lead_source,
  created_at,
  updated_at
) VALUES (
  '03822091-dea0-4104-808b-a7d73c2725a7',
  'joaosaralho@gmail.com',
  'joao saralho',
  1,
  'active',
  true,
  'Free',
  'pt-BR',
  true,
  false,
  'google_oauth',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;