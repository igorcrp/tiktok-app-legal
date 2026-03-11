
-- Remover políticas atuais e recriar como PERMISSIVE
DROP POLICY IF EXISTS "admins_full_access_assets_control" ON public.assets_control;
DROP POLICY IF EXISTS "users_read_active_visible_assets" ON public.assets_control;

-- Política PERMISSIVA para admins - acesso total
CREATE POLICY "admins_full_access_assets_control" 
ON public.assets_control 
FOR ALL 
TO authenticated 
USING (is_admin())
WITH CHECK (is_admin());

-- Política PERMISSIVA para usuários normais - apenas ativos visíveis
CREATE POLICY "users_read_active_visible_assets" 
ON public.assets_control 
FOR SELECT 
TO authenticated 
USING ((is_active = true) AND (is_visible = true));
