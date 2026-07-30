-- 1. Remove manual payment proof flow
DROP TRIGGER IF EXISTS on_payment_verification_status ON public.payment_verifications;
DROP TABLE IF EXISTS public.payment_verification_audit CASCADE;
DROP TABLE IF EXISTS public.payment_verifications CASCADE;
DROP FUNCTION IF EXISTS public.on_payment_verification_status() CASCADE;

-- 2. Orders payment fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 3. Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  provider text NOT NULL DEFAULT 'momo',
  phone text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  external_ref text,
  failure_reason text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_provider_ref_idx ON public.payments(provider_ref);
CREATE UNIQUE INDEX IF NOT EXISTS payments_external_ref_key ON public.payments(external_ref);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all payments" ON public.payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS touch_payments_updated_at ON public.payments;
CREATE TRIGGER touch_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Mark paid + auto-credit cashback (backend only)
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _reference text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o RECORD;
  amt numeric := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF o.paid_at IS NULL THEN
    UPDATE public.orders
      SET status = 'paid',
          paid_at = now(),
          payment_reference = COALESCE(_reference, payment_reference)
      WHERE id = _order_id;
  END IF;

  amt := public.credit_order_cashback(_order_id);
  RETURN amt;
END; $$;

REVOKE ALL ON FUNCTION public.mark_order_paid(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text) TO service_role;

-- 5. Ensure order status trigger also handles 'paid'
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'order_status',
      'Order status: ' || NEW.status,
      'Your order for FRW ' || NEW.total || ' is now ' || NEW.status || '.',
      '/account');

    IF NEW.status IN ('paid','payment_verified','processing','shipped','approved','delivered','completed')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('paid','payment_verified','processing','shipped','approved','delivered','completed')) THEN
      PERFORM public.recount_and_unlock_rewards(NEW.user_id);
    END IF;

    IF NEW.status IN ('paid','completed') THEN
      PERFORM public.credit_order_cashback(NEW.id);
    ELSIF NEW.status IN ('cancelled','refunded') THEN
      PERFORM public.reverse_order_cashback(NEW.id, 'Order ' || NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();