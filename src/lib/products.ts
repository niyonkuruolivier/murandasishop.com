import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

import type { ProductSpecs } from "@/lib/specs";
import type { ProductVariations } from "@/lib/variations";

export type Category = {
  id?: string;
  slug: string;
  name: string;
  emoji: string;
  sort_order?: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  shippingPrice: number;
  stock: number;
  inStock: boolean;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  warranty: string;
  delivery: string;
  specs: ProductSpecs;
  variations?: ProductVariations;
  cashbackPercent: number;
};

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products", false),
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/categories", false),
    staleTime: 60_000,
  });
}

export function useProductBySlug(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => apiGet<Product | null>(`/products/${encodeURIComponent(slug)}`, false),
    enabled: !!slug,
  });
}
