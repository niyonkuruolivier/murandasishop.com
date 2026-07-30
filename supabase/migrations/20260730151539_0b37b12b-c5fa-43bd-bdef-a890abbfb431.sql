-- 1. Remove old gift/milestone reward feature
DROP TRIGGER IF EXISTS on_reward_claim_change_trg ON public.reward_claims;
DROP FUNCTION IF EXISTS public.on_reward_claim_change() CASCADE;
DROP TABLE IF EXISTS public.reward_claims CASCADE;
DROP TABLE IF EXISTS public.reward_milestones CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS reward_cycle_start;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS gifts_claimed;

-- 2. Product cashback percentage
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cashback_percent numeric NOT NULL DEFAULT 0;

-- 3. Order cashback columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momo_amount numeric,
  ADD COLUMN IF NOT EXISTS cashback_awarded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_status text NOT NULL DEFAULT 'none';

UPDATE public.orders SET momo_amount = total WHERE momo_amount IS NULL;

-- 4. Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins read all wallets" ON public.wallets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('earned','used','reversed','adjustment')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins read all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);

-- 6. Wallet helpers
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wid uuid;
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO wid FROM public.wallets WHERE user_id = _user_id;
  RETURN wid;
END; $$;

CREATE OR REPLACE FUNCTION public.my_wallet_balance()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  PERFORM public.ensure_wallet(auth.uid());
  SELECT balance INTO bal FROM public.wallets WHERE user_id = auth.uid();
  RETURN COALESCE(bal, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.my_wallet_balance() TO authenticated;

-- create wallet for every new profile
CREATE OR REPLACE FUNCTION public.on_profile_created_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_wallet(NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_wallet_trg ON public.profiles;
CREATE TRIGGER profiles_wallet_trg AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_created_wallet();

INSERT INTO public.wallets (user_id)
  SELECT id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;

-- 7. Redeem wallet balance against an order (called right after the order is created)
CREATE OR REPLACE FUNCTION public.redeem_wallet_for_order(_order_id uuid, _amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  o RECORD;
  bal numeric;
  use_amt numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.wallet_applied > 0 THEN RETURN o.wallet_applied; END IF;

  PERFORM public.ensure_wallet(uid);
  SELECT balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;

  use_amt := LEAST(GREATEST(COALESCE(_amount, 0), 0), COALESCE(bal, 0), o.total);
  IF use_amt <= 0 THEN RETURN 0; END IF;

  UPDATE public.wallets SET balance = balance - use_amt WHERE user_id = uid
    RETURNING balance INTO bal;

  INSERT INTO public.wallet_transactions (user_id, order_id, type, amount, balance_after, note)
  VALUES (uid, _order_id, 'used', -use_amt, bal, 'Cashback used at checkout');

  UPDATE public.orders
    SET wallet_applied = use_amt, momo_amount = o.total - use_amt
    WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'cashback_used', 'Cashback used',
    'FRW ' || trim(to_char(use_amt, 'FM999999999')) ||
    ' has been deducted from your Murandasi Cashback Wallet. Your remaining cashback balance is FRW ' ||
    trim(to_char(bal, 'FM999999999')) || '.', '/account');

  RETURN use_amt;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_for_order(uuid, numeric) TO authenticated;

-- 8. Cashback computation: only on the Mobile Money portion
CREATE OR REPLACE FUNCTION public.compute_order_cashback(_order_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD;
  line_total numeric := 0;
  weighted numeric := 0;
  ratio numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR COALESCE(o.momo_amount, o.total) <= 0 THEN RETURN 0; END IF;

  SELECT
    COALESCE(SUM(qty * price), 0),
    COALESCE(SUM(qty * price * COALESCE(p.cashback_percent, 0) / 100.0), 0)
  INTO line_total, weighted
  FROM (
    SELECT
      GREATEST(COALESCE((item->>'qty')::numeric, COALESCE((item->>'quantity')::numeric, 1)), 1) AS qty,
      COALESCE((item->>'price')::numeric, 0) AS price,
      item->>'slug' AS slug
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
    ) AS item
  ) li
  LEFT JOIN public.products p ON p.slug = li.slug;

  IF line_total <= 0 THEN RETURN 0; END IF;
  ratio := LEAST(1, GREATEST(0, COALESCE(o.momo_amount, o.total) / line_total));
  RETURN round(weighted * ratio);
END; $$;
GRANT EXECUTE ON FUNCTION public.compute_order_cashback(uuid) TO authenticated;

-- 9. Credit / reverse cashback
CREATE OR REPLACE FUNCTION public.credit_order_cashback(_order_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD; amt numeric; bal numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.user_id IS NULL THEN RETURN 0; END IF;
  IF o.cashback_status = 'credited' THEN RETURN o.cashback_awarded; END IF;

  amt := public.compute_order_cashback(_order_id);
  IF amt <= 0 THEN
    UPDATE public.orders SET cashback_status = 'none', cashback_awarded = 0 WHERE id = _order_id;
    RETURN 0;
  END IF;

  PERFORM public.ensure_wallet(o.user_id);
  UPDATE public.wallets SET balance = balance + amt WHERE user_id = o.user_id
    RETURNING balance INTO bal;

  INSERT INTO public.wallet_transactions (user_id, order_id, type, amount, balance_after, note)
  VALUES (o.user_id, _order_id, 'earned', amt, bal, 'Cashback earned from completed order');

  UPDATE public.orders SET cashback_status = 'credited', cashback_awarded = amt WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.user_id, 'cashback_earned', '🎉 Congratulations!',
    'You earned FRW ' || trim(to_char(amt, 'FM999999999')) ||
    ' cashback from your purchase. It has been added to your Murandasi Cashback Wallet and can be used on your next order.',
    '/account');

  RETURN amt;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_order_cashback(_order_id uuid, _reason text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD; amt numeric; bal numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.user_id IS NULL THEN RETURN 0; END IF;
  IF o.cashback_status <> 'credited' OR o.cashback_awarded <= 0 THEN RETURN 0; END IF;

  amt := o.cashback_awarded;
  UPDATE public.wallets SET balance = balance - amt WHERE user_id = o.user_id
    RETURNING balance INTO bal;

  INSERT INTO public.wallet_transactions (user_id, order_id, type, amount, balance_after, note)
  VALUES (o.user_id, _order_id, 'reversed', -amt, bal,
    COALESCE(_reason, 'Cashback reversed'));

  UPDATE public.orders SET cashback_status = 'reversed' WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.user_id, 'cashback_reversed', 'Cashback reversed',
    'FRW ' || trim(to_char(amt, 'FM999999999')) ||
    ' cashback has been removed from your Murandasi Cashback Wallet' ||
    COALESCE('. Reason: ' || _reason, '.') ||
    ' Your balance is now FRW ' || trim(to_char(bal, 'FM999999999')) || '.',
    '/account');

  RETURN amt;
END; $$;

-- admin-callable manual controls
CREATE OR REPLACE FUNCTION public.admin_reverse_cashback(_order_id uuid, _reason text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN public.reverse_order_cashback(_order_id, _reason);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reverse_cashback(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_user_id uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF COALESCE(_amount, 0) = 0 THEN RETURN 0; END IF;
  PERFORM public.ensure_wallet(_user_id);
  UPDATE public.wallets SET balance = GREATEST(0, balance + _amount) WHERE user_id = _user_id
    RETURNING balance INTO bal;
  INSERT INTO public.wallet_transactions (user_id, order_id, type, amount, balance_after, note)
  VALUES (_user_id, NULL, 'adjustment', _amount, bal, COALESCE(_note, 'Admin adjustment'));
  RETURN bal;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;

-- 10. Order status trigger
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'order_status',
      'Order status: ' || NEW.status,
      'Your order for FRW ' || NEW.total || ' is now ' || NEW.status || '.',
      '/account');

    IF NEW.status IN ('payment_verified','processing','shipped','approved','delivered','completed')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('payment_verified','processing','shipped','approved','delivered','completed')) THEN
      PERFORM public.recount_and_unlock_rewards(NEW.user_id);
    END IF;

    IF NEW.status = 'completed' THEN
      PERFORM public.credit_order_cashback(NEW.id);
    ELSIF NEW.status IN ('cancelled','refunded') THEN
      PERFORM public.reverse_order_cashback(NEW.id, 'Order ' || NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_status_change_trg ON public.orders;
CREATE TRIGGER orders_status_change_trg AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();

DROP TRIGGER IF EXISTS orders_touch ON public.orders;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 11. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;