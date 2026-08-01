CREATE OR REPLACE FUNCTION public.my_referral_list()
RETURNS TABLE (
  id uuid,
  name text,
  created_at timestamptz,
  status text,
  reward_amount numeric,
  rewarded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         COALESCE(NULLIF(p.full_name, ''), split_part(COALESCE(p.email, 'Murandasi customer'), '@', 1)) AS name,
         r.created_at,
         r.status,
         r.reward_amount,
         r.rewarded_at
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.my_referral_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_referral(_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  ref_id uuid;
  code text := upper(trim(coalesce(_code, '')));
  referred_name text;
  amt numeric;
BEGIN
  IF uid IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF code = '' THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = uid) THEN RETURN 'already_referred'; END IF;
  IF (SELECT referred_by FROM public.profiles WHERE id = uid) IS NOT NULL THEN RETURN 'already_referred'; END IF;

  SELECT id INTO ref_id FROM public.profiles WHERE referral_code = code;
  IF ref_id IS NULL THEN RETURN 'invalid'; END IF;
  IF ref_id = uid THEN RETURN 'self'; END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = uid) THEN RETURN 'not_eligible'; END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, code) VALUES (ref_id, uid, code)
    ON CONFLICT (referred_id) DO NOTHING;
  UPDATE public.profiles SET referred_by = ref_id WHERE id = uid AND referred_by IS NULL;

  SELECT COALESCE(NULLIF(full_name, ''), split_part(COALESCE(email, 'A new user'), '@', 1))
    INTO referred_name FROM public.profiles WHERE id = uid;
  SELECT reward_amount INTO amt FROM public.referral_settings WHERE id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (ref_id, 'referral_new', '🎉 Congratulations! You have a new referral.',
    referred_name || ' has registered using your referral link. We are waiting for them to complete their first purchase. Once they do, you will receive RWF ' ||
    trim(to_char(COALESCE(amt, 1000), 'FM999999999')) || ' cashback.',
    '/account');
  RETURN 'linked';
END; $function$;