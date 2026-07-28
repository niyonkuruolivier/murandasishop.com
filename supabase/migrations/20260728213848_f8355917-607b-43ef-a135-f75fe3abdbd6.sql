
CREATE TABLE public.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image text NOT NULL,
  title text NOT NULL DEFAULT '',
  highlight text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Shop Now',
  cta_href text NOT NULL DEFAULT '/search',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hero_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT ALL ON public.hero_slides TO service_role;

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero slides public read" ON public.hero_slides
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins write hero slides" ON public.hero_slides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER hero_slides_touch_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.hero_slides (image, title, highlight, cta_label, cta_href, sort_order) VALUES
('https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=2400&q=85','Smart Electronics.','Better Prices.','Shop Now','/search',1),
('https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=2400&q=85','Latest Smartphones.','Unbeatable Deals.','Shop Phones','/category/phones',2),
('https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=2400&q=85','Powerful Laptops.','Work & Play.','Shop Laptops','/category/laptops',3),
('https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=2400&q=85','Stunning TVs.','Cinema at Home.','Shop TVs','/category/tvs',4),
('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=2400&q=85','Premium Audio.','Pure Sound.','Shop Audio','/category/headphones',5);
