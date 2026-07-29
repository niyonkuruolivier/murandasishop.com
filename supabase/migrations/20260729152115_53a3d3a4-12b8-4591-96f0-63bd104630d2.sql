
-- 1. Reset milestones to 10 / 20 / 50
DELETE FROM public.reward_claims WHERE milestone_id IS NOT NULL;
DELETE FROM public.reward_milestones;
INSERT INTO public.reward_milestones (purchases_required, title, description, emoji, active, sort_order) VALUES
  (10, '10 Purchases Reward', 'Reach 10 approved purchases to unlock your first reward.', '🥉', true, 1),
  (20, '20 Purchases Reward', 'Reach 20 approved purchases to unlock a bigger reward.', '🥈', true, 2),
  (50, '50 Purchases Reward', 'Reach 50 approved purchases to unlock our top reward.', '🥇', true, 3);

-- 2. RLS: allow users to submit a milestone-based pending claim
DROP POLICY IF EXISTS "Users submit own milestone claim" ON public.reward_claims;
CREATE POLICY "Users submit own milestone claim"
ON public.reward_claims
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND milestone_id IS NOT NULL
  AND cycle_index IS NULL
  AND EXISTS (
    SELECT 1 FROM public.reward_milestones m
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE m.id = reward_claims.milestone_id
      AND m.active = true
      AND p.approved_purchases >= m.purchases_required
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reward_claims rc
    WHERE rc.user_id = auth.uid()
      AND rc.milestone_id = reward_claims.milestone_id
      AND rc.status IN ('pending','approved','delivered','claimed','redeemed')
  )
);

-- 3. Stop auto-inserting "unlocked" milestone claims
CREATE OR REPLACE FUNCTION public.recount_and_unlock_rewards(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wa_count INTEGER;
  qty_total INTEGER;
  order_total NUMERIC;
  total_purchases INTEGER;
BEGIN
  SELECT COUNT(*) INTO wa_count FROM public.whatsapp_purchases
    WHERE user_id = _user_id AND status = 'approved';

  SELECT
    COALESCE(SUM( GREATEST( COALESCE((item->>'quantity')::int, COALESCE((item->>'qty')::int, 1)), 1) ), 0),
    COALESCE(SUM(o.total), 0)
  INTO qty_total, order_total
  FROM public.orders o
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
  ) AS item ON true
  WHERE o.user_id = _user_id
    AND o.status IN ('payment_verified','processing','shipped','approved','delivered');

  total_purchases := COALESCE(wa_count,0) + COALESCE(qty_total,0);

  UPDATE public.profiles
    SET approved_purchases = total_purchases,
        total_spent = COALESCE(order_total,0)
    WHERE id = _user_id;
END; $$;

-- 4. Notifications for milestone-based claims + keep legacy cycle claims working
CREATE OR REPLACE FUNCTION public.on_reward_claim_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_row RECORD;
  cust_name TEXT;
  m_title TEXT;
  m_emoji TEXT;
BEGIN
  -- Fetch milestone label if applicable
  IF NEW.milestone_id IS NOT NULL THEN
    SELECT title, emoji INTO m_title, m_emoji
      FROM public.reward_milestones WHERE id = NEW.milestone_id;
  END IF;

  -- New pending claim -> notify all admins
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(full_name, email, 'A customer') INTO cust_name
      FROM public.profiles WHERE id = NEW.user_id;
    FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (admin_row.user_id, 'reward_claim_pending',
        '🎁 New reward claim pending',
        cust_name || ' submitted a claim' ||
          CASE WHEN m_title IS NOT NULL THEN ' for ' || m_title ELSE '' END ||
          ' and is waiting for approval.',
        '/admin');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Legacy cycle-based rewards keep their old side-effects
    IF NEW.milestone_id IS NULL THEN
      IF NEW.status = 'approved' THEN
        UPDATE public.profiles
          SET reward_cycle_start = reward_cycle_start + 20,
              gifts_claimed = gifts_claimed + 1
          WHERE id = NEW.user_id;
        NEW.approved_at := COALESCE(NEW.approved_at, now());
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.user_id, 'gift_approved',
          '🎉 Congratulations!',
          'Your reward has been approved. You will receive your reward soon. We will contact you with the delivery details.',
          '/account');
      ELSIF NEW.status = 'rejected' THEN
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.user_id, 'gift_rejected',
          'Your reward claim was not approved',
          COALESCE('Reason: ' || NEW.rejection_reason, 'Please contact support for details.'),
          '/account');
      ELSIF NEW.status = 'delivered' THEN
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.user_id, 'gift_delivered',
          '📦 Reward delivered',
          'Your reward has been marked as delivered. Enjoy!',
          '/account');
      END IF;
      RETURN NEW;
    END IF;

    -- Milestone-based rewards
    IF NEW.status = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      UPDATE public.profiles SET gifts_claimed = gifts_claimed + 1 WHERE id = NEW.user_id;
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'reward_approved',
        '🎉 Congratulations! Your reward has been approved',
        'You will receive your reward soon. We will contact you with the delivery details.' ||
          CASE
            WHEN NEW.delivery_date IS NOT NULL OR NEW.delivery_time IS NOT NULL
            THEN ' Scheduled: ' || COALESCE(NEW.delivery_date::text, 'TBD') ||
                 CASE WHEN NEW.delivery_time IS NOT NULL THEN ' at ' || NEW.delivery_time ELSE '' END || '.'
            ELSE ''
          END,
        '/account');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'reward_rejected',
        'Your reward claim was not approved',
        COALESCE('Reason: ' || NEW.rejection_reason, 'Please contact support for details.'),
        '/account');
    ELSIF NEW.status = 'delivered' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'reward_delivered',
        '📦 Reward delivered',
        'Your reward has been marked as delivered. Enjoy!',
        '/account');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS trg_on_reward_claim_change ON public.reward_claims;
CREATE TRIGGER trg_on_reward_claim_change
BEFORE INSERT OR UPDATE ON public.reward_claims
FOR EACH ROW EXECUTE FUNCTION public.on_reward_claim_change();
