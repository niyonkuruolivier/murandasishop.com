
CREATE OR REPLACE FUNCTION public.recount_and_unlock_rewards(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wa_count INTEGER;
  qty_total INTEGER;
  order_total NUMERIC;
  total_purchases INTEGER;
  m RECORD;
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

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.orders WHERE user_id IS NOT NULL LOOP
    PERFORM public.recount_and_unlock_rewards(r.user_id);
  END LOOP;
END $$;
