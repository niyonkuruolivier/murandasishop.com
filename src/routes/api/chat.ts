import { createFileRoute } from "@tanstack/react-router";

type Message = { role: "user" | "assistant" | "system"; content: string };

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  price: number;
  stock: number;
  in_stock: boolean;
  warranty: string;
  delivery: string;
  specs: Record<string, string>;
};

function buildSystemPrompt(products: ProductRow[]) {
  const productList = products
    .map((p) => {
      const specs = Object.entries(p.specs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      return `- ${p.name} (${p.category_slug}) — FRW ${p.price.toLocaleString()}, ${p.in_stock ? `${p.stock} in stock` : "out of stock"}${specs ? ` | Specs: ${specs}` : ""}`;
    })
    .join("\n");

  return `You are the friendly AI support assistant for Murandasi Shop, an online electronics store in Rwanda.

About the shop:
- We sell phones, laptops, headphones, TVs, and other electronics.
- Prices are shown in FRW (Rwandan Francs).
- Payment options: MTN Mobile Money or Airtel Money.
- Customers can also order via WhatsApp at +250788723098.
- Delivery is available across Rwanda.

Current product catalog (prices and stock are accurate; do not invent different values):
${productList || "- No products loaded at the moment."}

Your job:
- Help customers find products, understand pricing, delivery, payment, and returns.
- When a customer asks about a product, always mention its exact specs (e.g., screen size, RAM, storage, battery, camera, processor, etc.) from the catalog above.
- Be brief, warm, and clear. Answer in the customer's language (English, French, or Kinyarwanda).
- If a product is not in the catalog or you don't know a specific detail, tell them to contact us on WhatsApp: +250788723098 or browse the shop.
- Never invent product prices, stock, or specs — only use the data above.`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages: Message[] };
          if (!Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400 });
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500 });
          }

          // Fetch live product data so the assistant can answer with accurate specs and stock.
          let products: ProductRow[] = [];
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data, error } = await supabaseAdmin
              .from("products")
              .select("id, slug, name, category_slug, price, stock, in_stock, warranty, delivery, specs");
            if (error) throw error;
            products = (data as ProductRow[]) || [];
          } catch (dbErr) {
            console.error("Support chat product fetch failed:", dbErr);
            // Continue without product data; the prompt will note the catalog is empty.
          }

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: "google/gemini-3.6-flash",
              messages: [{ role: "system", content: buildSystemPrompt(products) }, ...messages],
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            const status = res.status === 429 || res.status === 402 ? res.status : 500;
            const msg =
              res.status === 429
                ? "Too many requests, please try again in a moment."
                : res.status === 402
                ? "Support assistant is temporarily unavailable. Please try again later or WhatsApp us at +250788723098."
                : "Assistant error. Please try again.";
            console.error("AI gateway error:", res.status, text);
            return new Response(JSON.stringify({ error: msg }), { status });
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const reply = data.choices?.[0]?.message?.content ?? "";
          return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("chat handler error:", err);
          return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
      },
    },
  },
});
