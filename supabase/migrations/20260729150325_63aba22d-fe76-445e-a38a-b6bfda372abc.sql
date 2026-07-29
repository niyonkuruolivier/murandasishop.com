
-- Update RLS policy: require 20 purchases in current cycle
DROP POLICY IF EXISTS "Users submit own gift claim" ON public.reward_claims;
CREATE POLICY "Users submit own gift claim" ON public.reward_claims
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND milestone_id IS NULL
  AND cycle_index IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.approved_purchases - p.reward_cycle_start) >= 20
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reward_claims rc
    WHERE rc.user_id = auth.uid() AND rc.cycle_index = reward_claims.cycle_index
  )
);

-- Update trigger: advance cycle by 20 and new congrats message
CREATE OR REPLACE FUNCTION public.on_reward_claim_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        SET reward_cycle_start = reward_cycle_start + 20,
            gifts_claimed = gifts_claimed + 1
        WHERE id = NEW.user_id;
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'gift_approved',
        '🎉 Congratulations!',
        'Your gift claim has been accepted successfully. We will contact you as soon as possible to arrange delivery or collection of your gift. Thank you for being a valued customer!',
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
END; $function$;
