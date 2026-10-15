import { useQuery } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type SavedLocation = {
  id: string;
  label: string;
  address: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
};

export type LocationInput = Omit<SavedLocation, "id" | "is_default" | "created_at"> & {
  is_default?: boolean;
};

export function useSavedLocations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-locations", user?.id],
    enabled: Boolean(user),
    queryFn: () => apiGet<SavedLocation[]>("/locations"),
  });
}

export function createSavedLocation(input: LocationInput) {
  return apiPost<SavedLocation>("/locations", input);
}

export function deleteSavedLocation(id: string) {
  return apiDelete(`/locations/${encodeURIComponent(id)}`);
}

export function setDefaultLocation(id: string) {
  return apiPatch(`/locations/${encodeURIComponent(id)}/default`, {});
}

export async function detectDeliveryLocation() {
  if (!navigator.geolocation) throw new Error("Location detection is not supported by this browser.");
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  });
  const latitude = Number(position.coords.latitude.toFixed(7));
  const longitude = Number(position.coords.longitude.toFixed(7));
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error("Could not look up this location.");
  const result = await response.json();
  const address = result.address || {};
  const city = address.city || address.town || address.municipality || address.village || "Kigali";
  const label = result.display_name ? String(result.display_name).split(",").slice(0, 2).join(",") : "Current location";
  return {
    label,
    address: result.display_name || `${latitude}, ${longitude}`,
    city,
    country: address.country || "Rwanda",
    latitude,
    longitude,
  };
}

export function googleMapsLink(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
