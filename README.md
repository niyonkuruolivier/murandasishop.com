# Murandasi Shop

Build the **Murandasi Shop** website with one main goal:

**Make online shopping so simple that anyone can understand it within 10 seconds.**

Do not copy Amazon, Jumia, or Alibaba. Remove unnecessary complexity and focus on clarity.

## Homepage

The homepage should immediately display products.

No large banners.

No popups.

No advertisements.

No confusing menus.

Users should see products immediately after opening the website.

---

## Product Layout

Every product card should contain only:

📷 Large Product Image

📱 Product Name

💰 Price

⭐ Rating

🟢 In Stock / 🔴 Out of Stock

🛒 Add to Cart button

⚡ Buy Now button

Nothing else.

Keep every card clean with plenty of spacing.

---

## Categories

Display categories as simple icons at the top.

📱 Phones

💻 Laptops

⌚ Smart Watches

🎧 Headphones

📺 TVs

🎮 Gaming

🔌 Accessories

Users tap one category and immediately see products.

---

## Product Details

When a customer opens a product, show only important information.

Large Images

Product Name

Price

Availability

Warranty

Delivery Time

Below that:

### Why Buy This?

✔ Genuine Product

✔ Fast Delivery

✔ Manufacturer Warranty

✔ Easy Returns

Buttons:

🛒 Add to Cart

⚡ Buy Now

Hide specifications inside a "View Specifications" button.

---

## Search

Place a large search bar at the top.

Placeholder:

"What are you looking for?"

Search results should appear instantly while typing.

---

## Shopping

Buying a product should require very few steps.

Product

↓

Add to Cart

↓

Checkout

↓

Payment

↓

Done

No unnecessary pages.

---

## Cart

Each cart item should display:

Image

Product Name

Quantity

Price

Remove Button

Large Checkout Button

---

## Checkout

Keep checkout on one page.

Shipping Address

Payment Method

Place Order

That's all.

---

## Navigation

Simple navigation.

🏠 Home

📂 Categories

🔍 Search

🛒 Cart

👤 Account

---

## Colors

Background: White

Primary: Black

Accent: Orange (#FF6B00)

Success: Green

Use plenty of white space.

---

## Animations

Use only subtle animations.

Smooth hover effects.

Smooth page transitions.

Small Add-to-Cart animation.

Avoid flashy effects.

---

## Performance

- Fast loading

- Responsive on mobile, tablet, and desktop

- SEO optimized

- Progressive Web App (PWA)

- Lazy-loaded images

---

## User Experience Rules

- Every product should be understandable within 5 seconds.

- Every purchase should take less than 1 minute.

- Never overload the screen with information.

- Use large images instead of long text.

- Show only what customers need to make a buying decision.

- Keep every page clean, simple, and modern.

## Goal

Murandasi Shop should be one of the simplest electronics e-commerce websites in the world. Customers should be able to open the website, find a product, understand it instantly, and complete a purchase with almost no learning curve.

**Live site**: [https://murandasishop.com](https://murandasishop.com)

**Repository**: [github.com/niyonkuruolivier/murandasishop.com](https://github.com/niyonkuruolivier/murandasishop.com)

## Development

Node.js 18+ and npm (or Bun) required.

```sh
git clone https://github.com/niyonkuruolivier/murandasishop.com.git
cd murandasishop.com
npm install
cp .env.example .env   # then fill in DB, JWT, payment keys
npm run dev            # Vite + local API (see package.json)
```

Production: build the frontend (`npm run build`), deploy `dist/`, run `server/index.js` (Passenger/Node), and apply DB migrations on start.
