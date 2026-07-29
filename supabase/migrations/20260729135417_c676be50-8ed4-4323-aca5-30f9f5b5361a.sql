
-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  approved_purchases INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profiles_touch_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- ORDERS: link to user + approved status
-- =========================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);

-- Allow authenticated users to read their own orders
CREATE POLICY "Users read own orders" ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =========================================
-- WHATSAPP PURCHASES
-- =========================================
CREATE TABLE public.whatsapp_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  screenshot_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.whatsapp_purchases TO authenticated;
GRANT UPDATE, DELETE ON public.whatsapp_purchases TO authenticated;
GRANT ALL ON public.whatsapp_purchases TO service_role;

ALTER TABLE public.whatsapp_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wa purchases" ON public.whatsapp_purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own wa purchases" ON public.whatsapp_purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admins read all wa purchases" ON public.whatsapp_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update wa purchases" ON public.whatsapp_purchases
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete wa purchases" ON public.whatsapp_purchases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER wa_touch_updated BEFORE UPDATE ON public.whatsapp_purchases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- REWARD MILESTONES
-- =========================================
CREATE TABLE public.reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchases_required INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎁',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reward_milestones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reward_milestones TO authenticated;
GRANT ALL ON public.reward_milestones TO service_role;

ALTER TABLE public.reward_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active milestones" ON public.reward_milestones
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write milestones" ON public.reward_milestones
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER milestones_touch BEFORE UPDATE ON public.reward_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default milestones
INSERT INTO public.reward_milestones (purchases_required, title, description, emoji, sort_order) VALUES
  (3, '5% Off Coupon', 'Unlock a 5% discount on your next order.', '🎟️', 1),
  (5, 'Free Delivery', 'Get free delivery on your next purchase.', '🚚', 2),
  (10, '10% Off Coupon', 'A bigger discount just for loyal customers.', '🎉', 3),
  (20, 'Free Accessory Gift', 'Choose a free accessory with your next order.', '🎁', 4),
  (50, 'VIP Status', 'Priority support and exclusive early access.', '👑', 5);

-- =========================================
-- REWARD CLAIMS
-- =========================================
CREATE TABLE public.reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.reward_milestones(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unlocked', -- unlocked|claimed|redeemed
  claimed_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_id)
);

GRANT SELECT, UPDATE ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own claims" ON public.reward_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own claim as claimed" ON public.reward_claims
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('unlocked', 'claimed'));
CREATE POLICY "Admins read all claims" ON public.reward_claims
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all claims" ON public.reward_claims
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete claims" ON public.reward_claims
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER claims_touch BEFORE UPDATE ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- purchase_approved|milestone_unlocked|reward_ready|order_status|info
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX notifications_user_read_idx ON public.notifications(user_id, read, created_at DESC);

-- =========================================
-- LOYALTY ENGINE
-- =========================================
CREATE OR REPLACE FUNCTION public.recount_and_unlock_rewards(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wa_count INTEGER;
  order_count INTEGER;
  order_total NUMERIC;
  total_purchases INTEGER;
  m RECORD;
BEGIN
  SELECT COUNT(*) INTO wa_count
  FROM public.whatsapp_purchases
  WHERE user_id = _user_id AND status = 'approved';

  SELECT COUNT(*), COALESCE(SUM(total), 0) INTO order_count, order_total
  FROM public.orders
  WHERE user_id = _user_id AND status IN ('approved', 'delivered');

  total_purchases := COALESCE(wa_count, 0) + COALESCE(order_count, 0);

  UPDATE public.profiles
  SET approved_purchases = total_purchases,
      total_spent = COALESCE(order_total, 0)
  WHERE id = _user_id;

  FOR m IN
    SELECT * FROM public.reward_milestones
    WHERE active = true AND purchases_required <= total_purchases
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.reward_claims
      WHERE user_id = _user_id AND milestone_id = m.id
    ) THEN
      INSERT INTO public.reward_claims (user_id, milestone_id, status)
      VALUES (_user_id, m.id, 'unlocked');

      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        _user_id,
        'milestone_unlocked',
        'You unlocked: ' || m.title || ' ' || m.emoji,
        m.description,
        '/account'
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger on WhatsApp purchase status change
CREATE OR REPLACE FUNCTION public.on_wa_purchase_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'purchase_approved',
      'WhatsApp purchase approved 🎉',
      'Your submitted purchase has been verified and added to your loyalty count.',
      '/account');
    PERFORM public.recount_and_unlock_rewards(NEW.user_id);
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'info',
      'WhatsApp purchase not approved',
      COALESCE('Reason: ' || NEW.admin_notes, 'Please contact support if you believe this is a mistake.'),
      '/account');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wa_purchase_status_trg
  AFTER UPDATE ON public.whatsapp_purchases
  FOR EACH ROW EXECUTE FUNCTION public.on_wa_purchase_status();

-- Trigger on order status change to 'approved' or 'delivered'
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'order_status',
      'Order status: ' || NEW.status,
      'Your order for FRW ' || NEW.total || ' is now ' || NEW.status || '.',
      '/account');

    IF NEW.status IN ('approved', 'delivered')
       AND OLD.status NOT IN ('approved', 'delivered') THEN
      PERFORM public.recount_and_unlock_rewards(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_status_trg
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();

-- =========================================
-- STORAGE POLICIES: whatsapp-proofs bucket
-- Users upload/read under their own <uid>/ folder; admins read all.
-- =========================================
CREATE POLICY "Users upload own wa proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users read own wa proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Admins read all wa proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-proofs'
    AND public.has_role(auth.uid(), 'admin')
  );
