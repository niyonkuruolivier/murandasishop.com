
CREATE TABLE public.payment_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  order_number text,
  note text,
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_verifications TO authenticated;
GRANT SELECT, INSERT ON public.payment_verifications TO anon;
GRANT ALL ON public.payment_verifications TO service_role;

ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone submits payment verifications"
  ON public.payment_verifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND length(customer_name) > 0
    AND length(phone) > 0
    AND length(screenshot_url) > 0
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Users read own payment verifications"
  ON public.payment_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all payment verifications"
  ON public.payment_verifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own pending payment verifications"
  ON public.payment_verifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins update payment verifications"
  ON public.payment_verifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete payment verifications"
  ON public.payment_verifications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payment_verifications_touch
  BEFORE UPDATE ON public.payment_verifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX payment_verifications_status_idx ON public.payment_verifications(status, created_at DESC);
CREATE INDEX payment_verifications_user_idx ON public.payment_verifications(user_id);
CREATE INDEX payment_verifications_order_idx ON public.payment_verifications(order_id);

CREATE TABLE public.payment_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES public.payment_verifications(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_verification_audit TO authenticated;
GRANT ALL ON public.payment_verification_audit TO service_role;

ALTER TABLE public.payment_verification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment audit"
  ON public.payment_verification_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.on_payment_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email_val text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT email INTO admin_email_val FROM auth.users WHERE id = auth.uid();
    INSERT INTO public.payment_verification_audit (verification_id, admin_id, admin_email, action, note)
    VALUES (NEW.id, auth.uid(), admin_email_val, NEW.status, NEW.admin_notes);

    IF NEW.order_id IS NOT NULL AND NEW.status = 'approved' THEN
      UPDATE public.orders SET status = 'payment_verified' WHERE id = NEW.order_id;
    END IF;

    IF NEW.user_id IS NOT NULL THEN
      IF NEW.status = 'approved' THEN
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.user_id, 'payment_verified',
          '✅ Payment verified',
          'Your payment has been verified. Your order is now being processed and will be shipped soon.',
          '/account');
      ELSIF NEW.status = 'rejected' THEN
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (NEW.user_id, 'payment_rejected',
          '❌ Payment could not be verified',
          COALESCE('Reason: ' || NEW.admin_notes, 'Please upload a clearer payment confirmation or contact support.'),
          '/account');
      END IF;
    END IF;

    NEW.reviewed_at := now();
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_verifications_status
  BEFORE UPDATE ON public.payment_verifications
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_verification_status();

CREATE POLICY "Users upload own payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anon upload guest payment proofs"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = 'guest'
  );

CREATE POLICY "Users read own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read all payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.has_role(auth.uid(), 'admin')
  );
