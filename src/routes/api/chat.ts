import { createFileRoute } from "@tanstack/react-router";

type Message = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are the friendly AI support assistant for Murandasi Shop, an online electronics store in Rwanda.

About the shop:
- We sell phones, laptops, headphones, TVs, and other electronics.
- Prices are shown in FRW (Rwandan Francs).
- Payment options: MTN Mobile Money or Airtel Money.
- Customers can also order via WhatsApp at +250788723098.
- Delivery is available across Rwanda.

Your job:
- Help customers find products, understand pricing, delivery, payment, and returns.
- Be brief, warm, and clear. Answer in the customer's language (English, French, or Kinyarwanda).
- If you don't know a specific detail, tell them to contact us on WhatsApp: +250788723098.
- Never invent product prices or stock — suggest they browse the shop or contact support.`;

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

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: "google/gemini-3.6-flash",
              messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
