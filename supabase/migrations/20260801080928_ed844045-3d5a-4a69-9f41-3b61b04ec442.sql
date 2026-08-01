-- 1. Settings (configurable rewards / campaigns)
CREATE TABLE public.referral_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  reward_amount numeric NOT NULL DEFAULT 1000,
  active boolean NOT NULL DEFAULT true,
  max_rewards_per_referrer integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_settings TO authenticated, anon;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referral settings public read" ON public.referral_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write referral settings" ON public.referral_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER referral_settings_touch BEFORE UPDATE ON public.referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.referral_settings (id) VALUES (true);

-- 2. Referral code + link on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  LOOP
    c := upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = c);
  END LOOP;
  RETURN c;
END; $$;

UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;
ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_set_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- 3. Referrals ledger
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount numeric NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());
CREATE POLICY "Admins read all referrals" ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER referrals_touch BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Attach a referral at signup (called by the referred user)
CREATE OR REPLACE FUNCTION public.attach_referral(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  ref_id uuid;
  code text := upper(trim(coalesce(_code, '')));
  referred_name text;
BEGIN
  IF uid IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF code = '' THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = uid) THEN RETURN 'already_referred'; END IF;
  IF (SELECT referred_by FROM public.profiles WHERE id = uid) IS NOT NULL THEN RETURN 'already_referred'; END IF;

  SELECT id INTO ref_id FROM public.profiles WHERE referral_code = code;
  IF ref_id IS NULL THEN RETURN 'invalid'; END IF;
  IF ref_id = uid THEN RETURN 'self'; END IF;

  -- Only a fresh account may be attributed (anti-abuse: no retro-linking).
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = uid) THEN RETURN 'not_eligible'; END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, code) VALUES (ref_id, uid, code)
    ON CONFLICT (referred_id) DO NOTHING;
  UPDATE public.profiles SET referred_by = ref_id WHERE id = uid AND referred_by IS NULL;

  SELECT COALESCE(NULLIF(full_name, ''), 'A new customer') INTO referred_name FROM public.profiles WHERE id = uid;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (ref_id, 'referral_new', '🎉 Congratulations! You have a new referral.',
    referred_name || ' joined Murandasi using your referral link. You earn a reward once they complete their first purchase.',
    '/account');
  RETURN 'linked';
END; $$;

-- 5. Reward on first verified purchase
CREATE OR REPLACE FUNCTION public.process_referral_reward(_order_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o RECORD; r RECORD; amt numeric; bal numeric; referred_name text; cnt integer; s RECORD;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.user_id IS NULL THEN RETURN 0; END IF;
  IF o.paid_at IS NULL AND o.status NOT IN ('paid','completed') THEN RETURN 0; END IF;
  -- Only real money counts: a fully wallet-funded order cannot mint rewards.
  IF COALESCE(o.momo_amount, o.total) <= 0 THEN RETURN 0; END IF;

  SELECT * INTO s FROM public.referral_settings WHERE id;
  IF NOT FOUND OR NOT s.active THEN RETURN 0; END IF;

  SELECT * INTO r FROM public.referrals WHERE referred_id = o.user_id FOR UPDATE;
  IF NOT FOUND OR r.status = 'rewarded' THEN RETURN 0; END IF;

  IF s.max_rewards_per_referrer IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.referrals WHERE referrer_id = r.referrer_id AND status = 'rewarded';
    IF cnt >= s.max_rewards_per_referrer THEN RETURN 0; END IF;
  END IF;

  amt := s.reward_amount;
  IF amt <= 0 THEN RETURN 0; END IF;

  PERFORM public.ensure_wallet(r.referrer_id);
  UPDATE public.wallets SET balance = balance + amt WHERE user_id = r.referrer_id RETURNING balance INTO bal;

  SELECT COALESCE(NULLIF(full_name, ''), 'your referral') INTO referred_name FROM public.profiles WHERE id = o.user_id;

  INSERT INTO public.wallet_transactions (user_id, order_id, type, amount, balance_after, note)
  VALUES (r.referrer_id, _order_id, 'referral', amt, bal,
    'Referral reward — ' || referred_name || ' (' || left(o.user_id::text, 8) || ') completed their first purchase');

  UPDATE public.referrals SET status = 'rewarded', reward_amount = amt, rewarded_at = now(), order_id = _order_id
    WHERE id = r.id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (r.referrer_id, 'referral_reward', '💰 Referral reward earned!',
    'FRW ' || trim(to_char(amt, 'FM999999999')) || ' has been added to your Murandasi Cashback Wallet because ' ||
    referred_name || ' completed their first purchase.', '/account');

  RETURN amt;
END; $$;

-- 6. Hook into the existing payment finalisation paths
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _reference text DEFAULT NULL::text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; amt numeric := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF o.paid_at IS NULL THEN
    UPDATE public.orders SET status = 'paid', paid_at = now(),
      payment_reference = COALESCE(_reference, payment_reference) WHERE id = _order_id;
  END IF;
  amt := public.credit_order_cashback(_order_id);
  PERFORM public.process_referral_reward(_order_id);
  RETURN amt;
END; $$;

CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'order_status', 'Order status: ' || NEW.status,
      'Your order for FRW ' || NEW.total || ' is now ' || NEW.status || '.', '/account');

    IF NEW.status IN ('paid','payment_verified','processing','shipped','approved','delivered','completed')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('paid','payment_verified','processing','shipped','approved','delivered','completed')) THEN
      PERFORM public.recount_and_unlock_rewards(NEW.user_id);
    END IF;

    IF NEW.status IN ('paid','completed') THEN
      PERFORM public.credit_order_cashback(NEW.id);
      PERFORM public.process_referral_reward(NEW.id);
    ELSIF NEW.status IN ('cancelled','refunded') THEN
      PERFORM public.reverse_order_cashback(NEW.id, 'Order ' || NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 7. Dashboard stats
CREATE OR REPLACE FUNCTION public.my_referral_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  PERFORM public.ensure_wallet(uid);
  SELECT jsonb_build_object(
    'code', (SELECT referral_code FROM public.profiles WHERE id = uid),
    'total', (SELECT COUNT(*) FROM public.referrals WHERE referrer_id = uid),
    'successful', (SELECT COUNT(*) FROM public.referrals WHERE referrer_id = uid AND status = 'rewarded'),
    'earnings', (SELECT COALESCE(SUM(reward_amount), 0) FROM public.referrals WHERE referrer_id = uid AND status = 'rewarded'),
    'balance', (SELECT COALESCE(balance, 0) FROM public.wallets WHERE user_id = uid),
    'reward_amount', (SELECT reward_amount FROM public.referral_settings WHERE id)
  ) INTO res;
  RETURN res;
END; $$;

-- 8. Execute permissions (match the project's locked-down RPC policy)
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_reward(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_referral(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_referral_stats() TO authenticated;