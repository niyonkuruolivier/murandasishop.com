import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

import type { ProductSpecs } from "@/lib/specs";
import type { ProductVariations } from "@/lib/variations";
export { rowsToSpecs, specsToRows, type SpecRow } from "@/lib/specs";

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  price: number;
  shipping_price: number;
  stock: number;
  in_stock: boolean;
  rating: number;
  reviews: number;
  image: string;
  images: string[] | null;
  warranty: string;
  delivery: string;
  specs: ProductSpecs;
  variations?: ProductVariations | null;
  cashback_percent: number;
};

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: () => apiGet<AdminProduct[]>("/products/admin"),
  });
}

export function useAdminProduct(productId: string) {
  return useQuery({
    queryKey: ["admin-products", productId],
    queryFn: async () => {
      const products = await apiGet<AdminProduct[]>("/products/admin");
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found.");
      return product;
    },
    enabled: !!productId,
  });
}
