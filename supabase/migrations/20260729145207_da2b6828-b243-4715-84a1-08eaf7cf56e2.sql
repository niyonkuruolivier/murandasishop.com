
-- Extend reward_claims
ALTER TABLE public.reward_claims
  ALTER COLUMN milestone_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS cycle_index INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_time TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Allow users to submit their own gift claim (cycle-based)
DROP POLICY IF EXISTS "Users submit own gift claim" ON public.reward_claims;
CREATE POLICY "Users submit own gift claim"
  ON public.reward_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND milestone_id IS NULL
    AND cycle_index IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.approved_purchases - p.reward_cycle_start) >= 10
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reward_claims rc
      WHERE rc.user_id = auth.uid()
        AND rc.cycle_index = reward_claims.cycle_index
    )
  );

-- Notify admins on new pending gift claim; handle admin state changes.
CREATE OR REPLACE FUNCTION public.on_reward_claim_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row RECORD;
  cust_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.milestone_id IS NULL THEN
    SELECT COALESCE(full_name, email, 'A customer') INTO cust_name
      FROM public.profiles WHERE id = NEW.user_id;
    FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (admin_row.user_id, 'gift_claim_pending',
        '🎁 New gift claim pending',
        cust_name || ' submitted a gift claim and is waiting for approval.',
        '/admin');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.milestone_id IS NULL THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.profiles
        SET reward_cycle_start = reward_cycle_start + 10,
            gifts_claimed = gifts_claimed + 1
        WHERE id = NEW.user_id;
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'gift_approved',
        '🎉 Congratulations! Your gift claim has been approved.',
        'Your reward has been confirmed. You will receive your gift on '
          || COALESCE(to_char(NEW.delivery_date, 'FMDay, FMMonth FMDD YYYY'), 'the scheduled date')
          || ' at ' || COALESCE(NEW.delivery_time, 'the scheduled time')
          || '. If you have any questions, please contact our support team.',
        '/account');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'gift_rejected',
        'Your gift claim was not approved',
        COALESCE('Reason: ' || NEW.rejection_reason, 'Please contact support for details.'),
        '/account');
    ELSIF NEW.status = 'delivered' THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'gift_delivered',
        '📦 Gift delivered',
        'Your gift has been marked as delivered. Enjoy!',
        '/account');
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reward_claim_change ON public.reward_claims;
CREATE TRIGGER trg_reward_claim_change
  BEFORE INSERT OR UPDATE ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.on_reward_claim_change();
