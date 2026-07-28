export type Category = {
  slug: string;
  name: string;
  emoji: string;
};

export const categories: Category[] = [
  { slug: "phones", name: "Phones", emoji: "📱" },
  { slug: "laptops", name: "Laptops", emoji: "💻" },
  { slug: "watches", name: "Smart Watches", emoji: "⌚" },
  { slug: "headphones", name: "Headphones", emoji: "🎧" },
  { slug: "tvs", name: "TVs", emoji: "📺" },
  { slug: "gaming", name: "Gaming", emoji: "🎮" },
  { slug: "accessories", name: "Accessories", emoji: "🔌" },
];

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  inStock: boolean;
  image: string;
  images: string[];
  warranty: string;
  delivery: string;
  specs: Record<string, string>;
};

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=85`;

// Extra image pool per category (used to guarantee 3+ preview images per product).
const extras: Record<string, string[]> = {
  phones: [
    "1511707171634-5f897ff02aa9",
    "1512499617640-c74ae3a79d37",
    "1580910051074-3eb694886505",
    "1567581935884-3349723552ca",
    "1585060544812-6b45742d762f",
  ],
  laptops: [
    "1496181133206-80ce9b88a853",
    "1541807084-5c52b6b3adef",
    "1484788984921-03950022c9ef",
    "1531297484001-80022131f5a1",
  ],
  watches: [
    "1523275335684-37898b6baf30",
    "1508685096489-7aacd43bd3b1",
    "1524805444758-089113d48a6d",
    "1434493789847-2f02dc6ca35d",
  ],
  headphones: [
    "1505740420928-5e560c06d30e",
    "1546435770-a3e426bf472b",
    "1484704849700-f032a568e944",
    "1590658268037-6bf12165a8df",
  ],
  tvs: [
    "1567690187548-f07b1d7bf5a9",
    "1509281373149-e957c6296406",
    "1552975084-6e027cd345c2",
    "1461151304267-38535e780c79",
  ],
  gaming: [
    "1493711662062-fa541adb3fc8",
    "1550745165-9bc0b252726f",
    "1580327344181-c1163234e5a0",
    "1592840496694-26d035b52b48",
  ],
  accessories: [
    "1625948515291-69613efd103f",
    "1618384887929-16ec33fab9ef",
    "1587202372775-e229f172b9d7",
    "1608156639585-b3a032ef9689",
  ],
};

const baseProducts: Omit<Product, "images">[] = [
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro 256GB",
    category: "phones",
    price: 1199,
    rating: 4.8,
    reviews: 1240,
    inStock: true,
    image: img("1696446701796-da61225697cc"),
    warranty: "1 Year Apple Warranty",
    delivery: "2-3 days",
    specs: { Display: "6.1\" OLED", Chip: "A17 Pro", Storage: "256GB", Camera: "48MP Triple" },
  },
  {
    id: "samsung-s24-ultra",
    name: "Samsung Galaxy S24 Ultra",
    category: "phones",
    price: 1299,
    rating: 4.7,
    reviews: 890,
    inStock: true,
    image: img("1610945265064-0e34e5519bbf"),
    warranty: "1 Year Samsung Warranty",
    delivery: "2-3 days",
    specs: { Display: "6.8\" AMOLED", Chip: "Snapdragon 8 Gen 3", Storage: "512GB", Camera: "200MP" },
  },
  {
    id: "pixel-8",
    name: "Google Pixel 8 128GB",
    category: "phones",
    price: 699,
    rating: 4.6,
    reviews: 512,
    inStock: false,
    image: img("1598327105666-5b89351aff97"),
    warranty: "1 Year Google Warranty",
    delivery: "3-5 days",
    specs: { Display: "6.2\" OLED", Chip: "Tensor G3", Storage: "128GB", Camera: "50MP" },
  },
  {
    id: "macbook-pro-14",
    name: "MacBook Pro 14\" M3",
    category: "laptops",
    price: 1999,
    rating: 4.9,
    reviews: 720,
    inStock: true,
    image: img("1517336714731-489689fd1ca8"),
    warranty: "1 Year Apple Warranty",
    delivery: "2-4 days",
    specs: { Display: "14\" Liquid Retina XDR", Chip: "Apple M3", RAM: "16GB", Storage: "512GB" },
  },
  {
    id: "dell-xps-15",
    name: "Dell XPS 15",
    category: "laptops",
    price: 1799,
    rating: 4.6,
    reviews: 410,
    inStock: true,
    image: img("1588872657578-7efd1f1555ed"),
    warranty: "2 Year Dell Warranty",
    delivery: "3-5 days",
    specs: { Display: "15.6\" OLED", CPU: "Intel i7", RAM: "16GB", Storage: "1TB SSD" },
  },
  {
    id: "apple-watch-9",
    name: "Apple Watch Series 9",
    category: "watches",
    price: 399,
    rating: 4.8,
    reviews: 980,
    inStock: true,
    image: img("1546868871-7041f2a55e12"),
    warranty: "1 Year Apple Warranty",
    delivery: "1-2 days",
    specs: { Display: "45mm Retina", Battery: "18 hours", GPS: "Yes", Water: "50m" },
  },
  {
    id: "galaxy-watch-6",
    name: "Galaxy Watch 6",
    category: "watches",
    price: 329,
    rating: 4.5,
    reviews: 340,
    inStock: true,
    image: img("1579586337278-3befd40fd17a"),
    warranty: "1 Year Samsung Warranty",
    delivery: "2-3 days",
    specs: { Display: "44mm AMOLED", Battery: "40 hours", GPS: "Yes" },
  },
  {
    id: "airpods-pro-2",
    name: "AirPods Pro (2nd Gen)",
    category: "headphones",
    price: 249,
    rating: 4.8,
    reviews: 2100,
    inStock: true,
    image: img("1600294037681-c80b4cb5b434"),
    warranty: "1 Year Apple Warranty",
    delivery: "1-2 days",
    specs: { Type: "In-Ear", ANC: "Yes", Battery: "6h + 24h case", Chip: "H2" },
  },
  {
    id: "sony-wh1000xm5",
    name: "Sony WH-1000XM5",
    category: "headphones",
    price: 399,
    rating: 4.9,
    reviews: 1580,
    inStock: true,
    image: img("1583394838336-acd977736f90"),
    warranty: "2 Year Sony Warranty",
    delivery: "2-3 days",
    specs: { Type: "Over-Ear", ANC: "Yes", Battery: "30 hours" },
  },
  {
    id: "lg-oled-c3",
    name: "LG OLED C3 55\"",
    category: "tvs",
    price: 1499,
    rating: 4.8,
    reviews: 620,
    inStock: true,
    image: img("1593359677879-a4bb92f829d1"),
    warranty: "2 Year LG Warranty",
    delivery: "5-7 days",
    specs: { Size: "55\"", Panel: "OLED", Resolution: "4K", HDR: "Dolby Vision" },
  },
  {
    id: "samsung-qled-65",
    name: "Samsung QLED 65\" 4K",
    category: "tvs",
    price: 1299,
    rating: 4.6,
    reviews: 430,
    inStock: false,
    image: img("1461151304267-38535e780c79"),
    warranty: "2 Year Samsung Warranty",
    delivery: "5-7 days",
    specs: { Size: "65\"", Panel: "QLED", Resolution: "4K", HDR: "HDR10+" },
  },
  {
    id: "ps5",
    name: "PlayStation 5 Slim",
    category: "gaming",
    price: 499,
    rating: 4.9,
    reviews: 3200,
    inStock: true,
    image: img("1606813907291-d86efa9b94db"),
    warranty: "1 Year Sony Warranty",
    delivery: "2-3 days",
    specs: { Storage: "1TB SSD", Resolution: "4K 120Hz", Disc: "Yes" },
  },
  {
    id: "xbox-series-x",
    name: "Xbox Series X",
    category: "gaming",
    price: 499,
    rating: 4.8,
    reviews: 2400,
    inStock: true,
    image: img("1621259182978-fbf93132d53d"),
    warranty: "1 Year Microsoft Warranty",
    delivery: "2-3 days",
    specs: { Storage: "1TB SSD", Resolution: "4K 120Hz" },
  },
  {
    id: "anker-charger",
    name: "Anker 65W USB-C Charger",
    category: "accessories",
    price: 39,
    rating: 4.7,
    reviews: 5400,
    inStock: true,
    image: img("1583863788434-e58a36330cf0"),
    warranty: "18 Month Anker Warranty",
    delivery: "1-2 days",
    specs: { Power: "65W", Ports: "USB-C", Compatible: "Universal" },
  },
  {
    id: "logitech-mx-master",
    name: "Logitech MX Master 3S",
    category: "accessories",
    price: 99,
    rating: 4.9,
    reviews: 3800,
    inStock: true,
    image: img("1527814050087-3793815479db"),
    warranty: "1 Year Logitech Warranty",
    delivery: "1-2 days",
    specs: { Type: "Wireless Mouse", DPI: "8000", Battery: "70 days" },
  },
];

// Ensure every product has at least 4 preview images (main + 3 alts) using a
// deterministic pool of category-relevant photos.
export const products: Product[] = baseProducts.map((p, idx) => {
  const pool = extras[p.category] ?? [];
  const alts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = pool[(idx + i) % Math.max(pool.length, 1)];
    if (id) alts.push(img(id));
  }
  const seen = new Set<string>();
  const images = [p.image, ...alts].filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
  return { ...p, images };
});

export const getProduct = (id: string) => products.find((p) => p.id === id);
export const getByCategory = (slug: string) =>
  products.filter((p) => p.category === slug);
