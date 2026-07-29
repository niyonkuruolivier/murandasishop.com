import { createFileRoute } from "@tanstack/react-router";

type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown;
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
  specs: Record<string, string>;
};

export type ChatProductWidget = {
  kind: "product" | "products";
  products: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    inStock: boolean;
    rating: number;
    image: string;
    images: string[];
    warranty: string;
    delivery: string;
    specs: Record<string, string>;
  }>;
};

function toClientProduct(p: ProductRow) {
  const images = p.images && p.images.length > 0 ? p.images : [p.image];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category_slug,
    price: Number(p.price),
    stock: p.stock ?? 0,
    inStock: p.in_stock && (p.stock ?? 0) > 0,
    rating: Number(p.rating ?? 4.5),
    image: p.image,
    images,
    warranty: p.warranty,
    delivery: p.delivery,
    specs: (p.specs as Record<string, string>) ?? {},
  };
}

const SYSTEM_PROMPT = `You are the AI shopping assistant for Murandasi Shop — an electronics store in Rwanda (prices in FRW, payments via MTN Mobile Money or Airtel Money, delivery across Rwanda).

You are NOT just a support chatbot — you are a full shopping assistant. Customers can browse, choose, and buy products entirely inside this chat without leaving it.

TOOLS (use them proactively):
- search_products: use whenever the user is looking for something ("show me phones", "any laptops under 500k", "cheapest headphones"). Prefer this over describing products in text.
- show_product: use when the user names or points to a specific product so we render the full product card.

RULES:
- When you call a tool, keep your text reply SHORT (1 sentence). The product cards are rendered visually — do NOT re-list price/specs/stock in text.
- Never invent products, prices, or specs. Only trust what tools return.
- If the user wants to buy, call show_product for that product; a Buy Now / Add to Cart flow will appear on the card. Reassure them they can complete purchase right here in the chat.
- Answer in the customer's language (English, French, or Kinyarwanda). Be warm and brief.
- For questions unrelated to products (delivery, payment, returns): answer in text, no tool call. Delivery is across Rwanda; payment is MTN MoMo or Airtel Money; WhatsApp fallback +250788723098.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the product catalog. Use for browse/discovery queries. Returns up to 6 matching products as rich cards in the chat.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free-text search over name, category, and specs. Empty string returns top products.",
          },
          category: {
            type: "string",
            description: "Optional category slug filter (e.g. phones, laptops, headphones, tvs).",
          },
          max_price: { type: "number", description: "Optional max price in FRW." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_product",
      description:
        "Render the full product card for a specific product so the user can buy it inside the chat. Use when the user selects or names one product.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Product slug." },
        },
        required: ["slug"],
      },
    },
  },
];

async function loadProducts(): Promise<ProductRow[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "id, slug, name, category_slug, price, stock, in_stock, rating, reviews, image, images, warranty, delivery, specs",
      );
    if (error) throw error;
    return (data as ProductRow[]) || [];
  } catch (err) {
    console.error("chat: product fetch failed", err);
    return [];
  }
}

function runSearch(
  products: ProductRow[],
  args: { query?: string; category?: string; max_price?: number },
): ProductRow[] {
  const q = (args.query || "").toLowerCase().trim();
  const cat = (args.category || "").toLowerCase().trim();
  const max = typeof args.max_price === "number" ? args.max_price : null;
  let list = products.slice();
  if (cat) list = list.filter((p) => p.category_slug.toLowerCase() === cat);
  if (max != null) list = list.filter((p) => Number(p.price) <= max);
  if (q) {
    list = list.filter((p) => {
      const hay = [
        p.name,
        p.category_slug,
        ...Object.entries(p.specs || {}).map(([k, v]) => `${k} ${v}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  // Prefer in-stock, then cheaper
  list.sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || Number(a.price) - Number(b.price));
  return list.slice(0, 6);
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
            return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
              status: 500,
            });
          }

          const products = await loadProducts();
          const productBySlug = new Map(products.map((p) => [p.slug, p]));
          const productSummaryList = products
            .map(
              (p) =>
                `- ${p.name} [slug: ${p.slug}, category: ${p.category_slug}, FRW ${Number(p.price).toLocaleString()}, ${p.in_stock ? `${p.stock} in stock` : "out of stock"}]`,
            )
            .join("\n");

          const convo: Message[] = [
            {
              role: "system",
              content: `${SYSTEM_PROMPT}\n\nAvailable catalog (use tools; do NOT read prices/specs from this list to the user):\n${productSummaryList || "- (empty)"}`,
            },
            ...messages,
          ];

          const widgets: ChatProductWidget[] = [];

          // Tool-calling loop, max 3 iterations
          for (let step = 0; step < 3; step++) {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: "google/gemini-3.6-flash",
                messages: convo,
                tools: TOOLS,
                tool_choice: "auto",
              }),
            });

            if (!res.ok) {
              const text = await res.text();
              const status = res.status === 429 || res.status === 402 ? res.status : 500;
              const msg =
                res.status === 429
                  ? "Too many requests, please try again in a moment."
                  : res.status === 402
                    ? "Assistant temporarily unavailable. WhatsApp us at +250788723098."
                    : "Assistant error. Please try again.";
              console.error("AI gateway error:", res.status, text);
              return new Response(JSON.stringify({ error: msg }), { status });
            }

            const data = (await res.json()) as {
              choices?: Array<{
                message?: {
                  content?: string | null;
                  tool_calls?: Array<{
                    id: string;
                    type: "function";
                    function: { name: string; arguments: string };
                  }>;
                };
              }>;
            };

            const msg = data.choices?.[0]?.message;
            const toolCalls = msg?.tool_calls || [];

            if (toolCalls.length === 0) {
              const reply = (msg?.content || "").trim();
              return new Response(JSON.stringify({ reply, widgets }), {
                headers: { "Content-Type": "application/json" },
              });
            }

            // Append assistant tool-call message
            convo.push({
              role: "assistant",
              content: msg?.content || "",
              tool_calls: toolCalls,
            } as Message);

            for (const call of toolCalls) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = {};
              }
              let toolResult: unknown = { ok: false };

              if (call.function.name === "search_products") {
                const matches = runSearch(products, args as {
                  query?: string;
                  category?: string;
                  max_price?: number;
                });
                const clientProducts = matches.map(toClientProduct);
                if (clientProducts.length > 0) {
                  widgets.push({
                    kind: clientProducts.length === 1 ? "product" : "products",
                    products: clientProducts,
                  });
                }
                toolResult = {
                  count: matches.length,
                  results: matches.map((p) => ({
                    slug: p.slug,
                    name: p.name,
                    price: Number(p.price),
                    in_stock: p.in_stock,
                    stock: p.stock,
                  })),
                };
              } else if (call.function.name === "show_product") {
                const slug = String((args as { slug?: string }).slug || "");
                const p = productBySlug.get(slug);
                if (p) {
                  widgets.push({ kind: "product", products: [toClientProduct(p)] });
                  toolResult = {
                    found: true,
                    product: {
                      slug: p.slug,
                      name: p.name,
                      price: Number(p.price),
                      stock: p.stock,
                      in_stock: p.in_stock,
                    },
                  };
                } else {
                  toolResult = { found: false, error: "Product not found." };
                }
              } else {
                toolResult = { error: "Unknown tool" };
              }

              convo.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              } as Message);
            }
          }

          // Fallback if loop exhausted
          return new Response(
            JSON.stringify({ reply: "Here's what I found.", widgets }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("chat handler error:", err);
          return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
        }
      },
    },
  },
});
