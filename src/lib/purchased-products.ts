import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function usePurchasedSlugs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["purchased-slugs", user?.id],
    enabled: !!user,
    queryFn: () => apiGet<string[]>("/profile/purchased-slugs"),
    staleTime: 60_000,
  });
}
