import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id?: string;
  slug: string;
  name: string;
  emoji: string;
  sort_order?: number;
};

export type Product = {
  id: string; // uuid
  slug: string;
  name: string;
  category: string; // category slug
  price: number;
  stock: number;
  inStock: boolean;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  warranty: string;
  delivery: string;
  specs: Record<string, string>;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  price: number;
  stock: number;
  in_stock: boolean;
  rating: number;
  reviews: number;
  image: string;
  images: string[] | null;
  warranty: string;
  delivery: string;
  specs: unknown;
};

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category_slug,
    price: Number(row.price),
    stock: row.stock ?? 0,
    inStock: row.in_stock && (row.stock ?? 0) > 0,
    rating: Number(row.rating ?? 4.5),
    reviews: row.reviews ?? 0,
    image: row.image,
    images: (row.images && row.images.length > 0 ? row.images : [row.image]) as string[],
    warranty: row.warranty,
    delivery: row.delivery,
    specs: (row.specs as Record<string, string>) ?? {},
  };
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(rowToProduct);
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as Category[];
}

export function useProducts() {
  return useQuery({ queryKey: ["products"], queryFn: fetchProducts, staleTime: 30_000 });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories, staleTime: 60_000 });
}

export function useProductBySlug(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProduct(data as ProductRow) : null;
    },
  });
}
