export const DEFAULT_WHATSAPP_E164 = "250784254890";
export const DEFAULT_WHATSAPP_DISPLAY = "+250 784 254 890";

/** @deprecated use contact settings from API */
export const WHATSAPP_NUMBER = DEFAULT_WHATSAPP_E164;
/** @deprecated use contact settings from API */
export const WHATSAPP_DISPLAY = DEFAULT_WHATSAPP_DISPLAY;

export function whatsappUrl(message: string, e164 = DEFAULT_WHATSAPP_E164) {
  const digits = String(e164).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function productMessage(p: { name: string; price: number }) {
  return `Hello Murandasi Shop! 👋\n\nI'd like to order:\n• ${p.name}\n• Price: FRW ${p.price.toLocaleString()}\n\nPlease confirm availability and delivery. Thank you!`;
}

export function cartMessage(
  items: { name: string; qty: number; price: number }[],
  total: number,
) {
  const lines = items
    .map((i) => `• ${i.name} × ${i.qty} — FRW ${(i.price * i.qty).toLocaleString()}`)
    .join("\n");
  return `Hello Murandasi Shop! 👋\n\nI'd like to place this order:\n${lines}\n\nTotal: FRW ${total.toLocaleString()}\n\nPlease confirm and share delivery details. Thank you!`;
}
