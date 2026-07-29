
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_wa_purchase_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recount_and_unlock_rewards(uuid) FROM PUBLIC, anon, authenticated;
