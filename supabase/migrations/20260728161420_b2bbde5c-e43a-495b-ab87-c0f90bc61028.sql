-- =====================================================
-- ROLES
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: first-ever signup becomes admin automatically.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- =====================================================
-- CATEGORIES
-- =====================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '📦',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write categories" ON public.categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category_slug text NOT NULL REFERENCES public.categories(slug) ON UPDATE CASCADE,
  price numeric(10,2) NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  in_stock boolean NOT NULL DEFAULT true,
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  reviews int NOT NULL DEFAULT 0,
  image text NOT NULL,
  images text[] NOT NULL DEFAULT ARRAY[]::text[],
  warranty text NOT NULL DEFAULT '1 Year Warranty',
  delivery text NOT NULL DEFAULT '2-3 days',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_category_idx ON public.products(category_slug);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write products" ON public.products FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- ORDERS
-- =====================================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'Rwanda',
  payment_method text NOT NULL,
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone places orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- =====================================================
-- SEED CATEGORIES
-- =====================================================
INSERT INTO public.categories (slug, name, emoji, sort_order) VALUES
  ('phones',      'Phones',         '📱', 1),
  ('laptops',     'Laptops',        '💻', 2),
  ('watches',     'Smart Watches',  '⌚', 3),
  ('headphones',  'Headphones',     '🎧', 4),
  ('tvs',         'TVs',            '📺', 5),
  ('gaming',      'Gaming',         '🎮', 6),
  ('accessories', 'Accessories',    '🔌', 7);

-- =====================================================
-- SEED PRODUCTS
-- =====================================================
INSERT INTO public.products (slug, name, category_slug, price, stock, in_stock, rating, reviews, image, images, warranty, delivery, specs) VALUES
('iphone-15-pro','iPhone 15 Pro 256GB','phones',1199,25,true,4.8,1240,
 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Apple Warranty','2-3 days','{"Display":"6.1\" OLED","Chip":"A17 Pro","Storage":"256GB","Camera":"48MP Triple"}'),
('samsung-s24-ultra','Samsung Galaxy S24 Ultra','phones',1299,18,true,4.7,890,
 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1567581935884-3349723552ca?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Samsung Warranty','2-3 days','{"Display":"6.8\" AMOLED","Chip":"Snapdragon 8 Gen 3","Storage":"512GB","Camera":"200MP"}'),
('pixel-8','Google Pixel 8 128GB','phones',699,0,false,4.6,512,
 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1567581935884-3349723552ca?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Google Warranty','3-5 days','{"Display":"6.2\" OLED","Chip":"Tensor G3","Storage":"128GB","Camera":"50MP"}'),
('macbook-pro-14','MacBook Pro 14" M3','laptops',1999,10,true,4.9,720,
 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1484788984921-03950022c9ef?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Apple Warranty','2-4 days','{"Display":"14\" Liquid Retina XDR","Chip":"Apple M3","RAM":"16GB","Storage":"512GB"}'),
('dell-xps-15','Dell XPS 15','laptops',1799,8,true,4.6,410,
 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1484788984921-03950022c9ef?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=85'],
 '2 Year Dell Warranty','3-5 days','{"Display":"15.6\" OLED","CPU":"Intel i7","RAM":"16GB","Storage":"1TB SSD"}'),
('apple-watch-9','Apple Watch Series 9','watches',399,30,true,4.8,980,
 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Apple Warranty','1-2 days','{"Display":"45mm Retina","Battery":"18 hours","GPS":"Yes","Water":"50m"}'),
('galaxy-watch-6','Galaxy Watch 6','watches',329,15,true,4.5,340,
 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Samsung Warranty','2-3 days','{"Display":"44mm AMOLED","Battery":"40 hours","GPS":"Yes"}'),
('airpods-pro-2','AirPods Pro (2nd Gen)','headphones',249,50,true,4.8,2100,
 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Apple Warranty','1-2 days','{"Type":"In-Ear","ANC":"Yes","Battery":"6h + 24h case","Chip":"H2"}'),
('sony-wh1000xm5','Sony WH-1000XM5','headphones',399,22,true,4.9,1580,
 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=85'],
 '2 Year Sony Warranty','2-3 days','{"Type":"Over-Ear","ANC":"Yes","Battery":"30 hours"}'),
('lg-oled-c3','LG OLED C3 55"','tvs',1499,6,true,4.8,620,
 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1552975084-6e027cd345c2?auto=format&fit=crop&w=1200&q=85'],
 '2 Year LG Warranty','5-7 days','{"Size":"55\"","Panel":"OLED","Resolution":"4K","HDR":"Dolby Vision"}'),
('samsung-qled-65','Samsung QLED 65" 4K','tvs',1299,0,false,4.6,430,
 'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1552975084-6e027cd345c2?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?auto=format&fit=crop&w=1200&q=85'],
 '2 Year Samsung Warranty','5-7 days','{"Size":"65\"","Panel":"QLED","Resolution":"4K","HDR":"HDR10+"}'),
('ps5','PlayStation 5 Slim','gaming',499,12,true,4.9,3200,
 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Sony Warranty','2-3 days','{"Storage":"1TB SSD","Resolution":"4K 120Hz","Disc":"Yes"}'),
('xbox-series-x','Xbox Series X','gaming',499,14,true,4.8,2400,
 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Microsoft Warranty','2-3 days','{"Storage":"1TB SSD","Resolution":"4K 120Hz"}'),
('anker-charger','Anker 65W USB-C Charger','accessories',39,100,true,4.7,5400,
 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85'],
 '18 Month Anker Warranty','1-2 days','{"Power":"65W","Ports":"USB-C","Compatible":"Universal"}'),
('logitech-mx-master','Logitech MX Master 3S','accessories',99,60,true,4.9,3800,
 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1200&q=85',
 ARRAY['https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85','https://images.unsplash.com/photo-1608156639585-b3a032ef9689?auto=format&fit=crop&w=1200&q=85'],
 '1 Year Logitech Warranty','1-2 days','{"Type":"Wireless Mouse","DPI":"8000","Battery":"70 days"}');