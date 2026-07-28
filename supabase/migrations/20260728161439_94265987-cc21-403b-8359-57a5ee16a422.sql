-- Revoke public execute on internal helper functions
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role must stay callable by signed-in users (RLS uses it)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Replace overly-permissive order insert policy with basic sanity checks
DROP POLICY IF EXISTS "Anyone places orders" ON public.orders;
CREATE POLICY "Anyone places orders" ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  length(customer_name) > 0
  AND length(phone) > 0
  AND length(address) > 0
  AND total >= 0
  AND jsonb_typeof(items) = 'array'
);