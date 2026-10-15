import { query } from "../utils/db.js";

export const DEFAULT_WHATSAPP_E164 = "250784254890";

/** Digits only, Rwanda-friendly (wa.me format without +). */
export function normalizeWhatsAppPhone(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) throw new Error("Enter a WhatsApp phone number.");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9) {
    digits = `250${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("7")) {
    digits = `250${digits}`;
  }
  if (digits.length < 11 || digits.length > 15) {
    throw new Error("Enter a valid phone number (e.g. 0784254890 or +250 784 254 890).");
  }
  return digits;
}

export function formatWhatsAppDisplay(e164Digits) {
  const d = String(e164Digits || "").replace(/\D/g, "");
  if (d.startsWith("250") && d.length >= 12) {
    const local = d.slice(3);
    return `+250 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`.trim();
  }
  if (d.length >= 10) {
    return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`.trim();
  }
  return d ? `+${d}` : "";
}

async function ensureRow() {
  const rows = await query("SELECT whatsapp_phone FROM shop_settings WHERE id = 1 LIMIT 1");
  if (rows[0]) return rows[0];
  await query("INSERT INTO shop_settings (id, whatsapp_phone) VALUES (1, ?)", [
    DEFAULT_WHATSAPP_E164,
  ]);
  return { whatsapp_phone: DEFAULT_WHATSAPP_E164 };
}

export async function getContactSettings() {
  const row = await ensureRow();
  const whatsapp_e164 = normalizeWhatsAppPhone(row.whatsapp_phone);
  return {
    whatsapp_e164,
    whatsapp_display: formatWhatsAppDisplay(whatsapp_e164),
  };
}

export async function updateWhatsAppPhone(rawInput) {
  const whatsapp_e164 = normalizeWhatsAppPhone(rawInput);
  await query("UPDATE shop_settings SET whatsapp_phone = ? WHERE id = 1", [whatsapp_e164]);
  return getContactSettings();
}
