import { query } from "../utils/db.js";
import { ok, fail } from "../utils/response.js";
import { getContactSettings } from "../model/shopSettingsModel.js";

const SYSTEM_PROMPT_BASE = `You are the AI shopping assistant for Murandasi Shop — an electronics store in Rwanda (prices in FRW, payments via MTN Mobile Money or Airtel Money, delivery across Rwanda).

You are NOT just a support chatbot — you are a full shopping assistant. Customers can browse, choose, and buy products entirely inside this chat without leaving it.

TOOLS (use them proactively):
- search_products: use whenever the user is looking for something ("show me phones", "any laptops under 500k", "cheapest headphones"). Prefer this over describing products in text.
- show_product: use when the user names or points to a specific product so we render the full product card.

RULES:
- When you call a tool, keep your text reply SHORT (1 sentence). The product cards are rendered visually — do NOT re-list price/specs/stock in text.
- Never invent products, prices, or specs. Only trust what tools return.
- If the user wants to buy, call show_product for that product; a Buy Now / Add to Cart flow will appear on the card. Reassure them they can complete purchase right here in the chat.
- Answer in the customer's language (English, French, or Kinyarwanda). Be warm and brief.
- For questions unrelated to products (delivery, payment, returns): answer in text, no tool call. Delivery is across Rwanda; payment is MTN MoMo or Airtel Money; WhatsApp fallback WHATSAPP_CONTACT.`;

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

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toClientProduct(p) {
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
    specs: p.specs ?? {},
  };
}

async function loadProducts() {
  try {
    const rows = await query(
      `SELECT id, slug, name, category_slug, price, stock, in_stock, rating, reviews, image, images, warranty, delivery, specs
       FROM products`,
    );
    return rows.map((r) => ({
      ...r,
      in_stock: Boolean(r.in_stock),
      images: parseJson(r.images, null),
      specs: parseJson(r.specs, {}),
    }));
  } catch (err) {
    console.error("chat: product fetch failed", err);
    return [];
  }
}

function runSearch(products, args) {
  const q = (args.query || "").toLowerCase().trim();
  const cat = (args.category || "").toLowerCase().trim();
  const max = typeof args.max_price === "number" ? args.max_price : null;
  let list = products.slice();
  if (cat) list = list.filter((p) => p.category_slug.toLowerCase() === cat);
  if (max != null) list = list.filter((p) => Number(p.price) <= max);
function specSearchText(value) {
  if (value && typeof value === "object" && "value" in value) {
    return String(value.value ?? "");
  }
  return String(value ?? "");
}

  if (q) {
    list = list.filter((p) => {
      const hay = [
        p.name,
        p.category_slug,
        ...Object.entries(p.specs || {}).map(([k, v]) => `${k} ${specSearchText(v)}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  list.sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || Number(a.price) - Number(b.price));
  return list.slice(0, 6);
}

export async function chat(req, res) {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages)) throw new Error("Invalid messages");

    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const products = await loadProducts();
    const productBySlug = new Map(products.map((p) => [p.slug, p]));
    const productSummaryList = products
      .map(
        (p) =>
          `- ${p.name} [slug: ${p.slug}, category: ${p.category_slug}, FRW ${Number(p.price).toLocaleString()}, ${p.in_stock ? `${p.stock} in stock` : "out of stock"}]`,
      )
      .join("\n");

    const contact = await getContactSettings();
    const systemPrompt = SYSTEM_PROMPT_BASE.replace(
      "WHATSAPP_CONTACT",
      contact.whatsapp_display,
    );

    const convo = [
      {
        role: "system",
        content: `${systemPrompt}\n\nAvailable catalog (use tools; do NOT read prices/specs from this list to the user):\n${productSummaryList || "- (empty)"}`,
      },
      ...messages,
    ];

    const widgets = [];

    for (let step = 0; step < 3; step++) {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!aiRes.ok) {
        const text = await aiRes.text();
        const status = aiRes.status === 429 ? 429 : aiRes.status === 401 ? 500 : 500;
        const msg =
          aiRes.status === 429
            ? "Too many requests, please try again in a moment."
            : aiRes.status === 401
              ? "Assistant misconfigured. Please contact support."
              : `Assistant error. Please try again. WhatsApp ${contact.whatsapp_display}.`;
        console.error("OpenAI error:", aiRes.status, text);
        return res.status(status).json({ error: msg });
      }

      const data = await aiRes.json();
      const msg = data.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls || [];

      if (toolCalls.length === 0) {
        return ok(res, { reply: (msg?.content || "").trim(), widgets });
      }

      convo.push({
        role: "assistant",
        content: msg?.content || "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        let toolResult = { ok: false };

        if (call.function.name === "search_products") {
          const matches = runSearch(products, args);
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
          const slug = String(args.slug || "");
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
        });
      }
    }

    return ok(res, { reply: "Here's what I found.", widgets });
  } catch (e) {
    return fail(res, e, 500);
  }
}
