
CREATE OR REPLACE FUNCTION public.recount_and_unlock_rewards(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wa_count INTEGER;
  order_count INTEGER;
  order_total NUMERIC;
  total_purchases INTEGER;
  m RECORD;
BEGIN
  SELECT COUNT(*) INTO wa_count FROM public.whatsapp_purchases
    WHERE user_id = _user_id AND status = 'approved';

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO order_count, order_total
    FROM public.orders
    WHERE user_id = _user_id
      AND status IN ('payment_verified','processing','shipped','approved','delivered');

  total_purchases := COALESCE(wa_count,0) + COALESCE(order_count,0);

  UPDATE public.profiles
    SET approved_purchases = total_purchases,
        total_spent = COALESCE(order_total,0)
    WHERE id = _user_id;

  FOR m IN SELECT * FROM public.reward_milestones
           WHERE active = true AND purchases_required <= total_purchases LOOP
    IF NOT EXISTS (SELECT 1 FROM public.reward_claims
                   WHERE user_id = _user_id AND milestone_id = m.id) THEN
      INSERT INTO public.reward_claims (user_id, milestone_id, status)
        VALUES (_user_id, m.id, 'unlocked');
      INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (_user_id, 'milestone_unlocked',
                'You unlocked: ' || m.title || ' ' || m.emoji,
                m.description, '/account');
    END IF;
  END LOOP;
END; $$;

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

    IF NEW.status IN ('payment_verified','processing','shipped','approved','delivered')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('payment_verified','processing','shipped','approved','delivered')) THEN
      PERFORM public.recount_and_unlock_rewards(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Backfill existing users
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.orders WHERE user_id IS NOT NULL LOOP
    PERFORM public.recount_and_unlock_rewards(r.user_id);
  END LOOP;
END $$;
