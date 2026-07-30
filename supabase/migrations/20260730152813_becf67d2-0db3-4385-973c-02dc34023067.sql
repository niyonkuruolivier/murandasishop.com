-- Lock down SECURITY DEFINER functions: revoke blanket PUBLIC/anon/authenticated EXECUTE
REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_order_cashback(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_order_cashback(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_order_cashback(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_profile_created_wallet() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_wallet_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_wallet_for_order(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reverse_cashback(uuid, text) FROM PUBLIC, anon;

-- Re-grant only what the app actually calls, to signed-in users
GRANT EXECUTE ON FUNCTION public.my_wallet_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_order(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reverse_cashback(uuid, text) TO authenticated;

-- Server-side/privileged paths keep access
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_order_cashback(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_order_cashback(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_order_cashback(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_wallet_balance() TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_order(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reverse_cashback(uuid, text) TO service_role;