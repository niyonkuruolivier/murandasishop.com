export const WHATSAPP_NUMBER = "250788723098";

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function productMessage(p: { name: string; price: number }) {
  return `Hello Murandasi Shop! 👋\n\nI'd like to order:\n• ${p.name}\n• Price: $${p.price.toLocaleString()}\n\nPlease confirm availability and delivery. Thank you!`;
}

export function cartMessage(
  items: { name: string; qty: number; price: number }[],
  total: number,
) {
  const lines = items
    .map((i) => `• ${i.name} × ${i.qty} — $${(i.price * i.qty).toLocaleString()}`)
    .join("\n");
  return `Hello Murandasi Shop! 👋\n\nI'd like to place this order:\n${lines}\n\nTotal: $${total.toLocaleString()}\n\nPlease confirm and share delivery details. Thank you!`;
}
