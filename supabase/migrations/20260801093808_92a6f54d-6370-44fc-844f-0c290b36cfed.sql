DROP POLICY IF EXISTS "Anyone places orders" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE SELECT ON public.orders FROM anon;
GRANT SELECT ON public.orders TO authenticated;
GRANT UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE SELECT ON public.payments FROM anon;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;