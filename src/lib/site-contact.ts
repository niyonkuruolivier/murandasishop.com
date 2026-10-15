import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api";
import {
  DEFAULT_WHATSAPP_DISPLAY,
  DEFAULT_WHATSAPP_E164,
  whatsappUrl as buildWhatsappUrl,
} from "@/lib/whatsapp";

export type ContactSettings = {
  whatsapp_e164: string;
  whatsapp_display: string;
};

const FALLBACK: ContactSettings = {
  whatsapp_e164: DEFAULT_WHATSAPP_E164,
  whatsapp_display: DEFAULT_WHATSAPP_DISPLAY,
};

export function useContactSettings() {
  return useQuery({
    queryKey: ["contact-settings"],
    queryFn: () => apiGet<ContactSettings>("/settings/contact", false),
    staleTime: 60_000,
    placeholderData: FALLBACK,
  });
}

export function useAdminContactSettings() {
  return useQuery({
    queryKey: ["admin-contact-settings"],
    queryFn: () => apiGet<ContactSettings>("/admin/settings/contact"),
  });
}

export async function updateWhatsAppContact(whatsapp_phone: string) {
  return apiPatch<ContactSettings>("/admin/settings/contact", { whatsapp_phone });
}

export function useContactSettingsActions() {
  const qc = useQueryClient();
  return {
    async save(whatsapp_phone: string) {
      const data = await updateWhatsAppContact(whatsapp_phone);
      qc.setQueryData(["admin-contact-settings"], data);
      qc.setQueryData(["contact-settings"], data);
      return data;
    },
  };
}

export function contactWhatsappUrl(message: string, contact: ContactSettings | undefined) {
  const e164 = contact?.whatsapp_e164 || DEFAULT_WHATSAPP_E164;
  return buildWhatsappUrl(message, e164);
}
