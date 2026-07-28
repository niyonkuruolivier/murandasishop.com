-- Drop the recursive SELECT policy that used has_role() on user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;

-- Simple self-read policy (no recursion, so SECURITY INVOKER has_role works fine)
CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Convert has_role from SECURITY DEFINER to SECURITY INVOKER.
-- It only ever reads the calling user's own row, which the self-read policy allows,
-- so it works without elevated privileges.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;