import "./loadEnv.js";
import { requestLogger } from "./utils/logger.js";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { rootDir } from "./loadEnv.js";
import apiRoutes from "./route/index.js";
import { intouchCallback } from "./controller/paymentController.js";
import { getCallbackTarget } from "./utils/intouchpay.js";
import { expirePendingCashback, releaseWalletsForFailedPayments } from "./utils/wallet.js";
import uploadRoutes from "./route/uploadRoutes.js";
import { runMigrations } from "./db/runMigrations.js";

const uploadDir = path.join(rootDir, "public/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
// cPanel Node.js App injects PORT — prefer that in production
const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
// Some gateways POST JSON with a text/* content type — keep the body readable.
app.use(express.text({ type: "text/*", limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));
// Compatibility for builds whose VITE_API_URL points to the domain root.
// The canonical route is also available at /api/uploads/product-image.
app.use("/uploads", uploadRoutes);
app.use("/api", requestLogger, apiRoutes);
// Docs example: POST https://yourapp.com/webhooks/intouch
app.post("/webhooks/intouch", requestLogger, intouchCallback);

const distDir = path.join(rootDir, "dist");
if (fs.existsSync(path.join(distDir, "index.html"))) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        if (filePath.endsWith(".webmanifest")) {
          res.setHeader("Content-Type", "application/manifest+json");
        }
        if (
          base === "index.html" ||
          base === "sw.js" ||
          base === "registerSW.js" ||
          base === "version.json" ||
          base === "manifest.webmanifest" ||
          base === "cache-reset.html"
        ) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/webhooks")
    ) {
      return next();
    }
    return res.sendFile(path.join(distDir, "index.html"));
  });
}

const CALLBACK_PATHS = [
  "/api/payments/intouchpay/callback",
  "/api/payments/intouch/callback",
  "/webhooks/intouch",
];

app.use((err, req, res, _next) => {
  console.error("[API]", err);
  // A webhook must still be acknowledged even if its body was unreadable,
  // otherwise IntouchPay keeps resending the same callback.
  if (CALLBACK_PATHS.includes(req.path)) {
    return res.status(200).json({
      message: "success",
      success: "True",
      request_id: `ack-${Date.now()}`,
    });
  }
  res.status(500).json({ error: err?.message || "Internal server error" });
});

async function start() {
  if (process.env.RUN_MIGRATIONS !== "false") {
    try {
      await runMigrations();
    } catch (error) {
      console.error("[Migrate] Startup migration failed:", error);
      console.error(
        "[Migrate] Fix migrations in phpMyAdmin, then restart. To start anyway: RUN_MIGRATIONS=false",
      );
      if (process.env.RUN_MIGRATIONS_STRICT !== "false") {
        process.exit(1);
      }
    }
  } else {
    console.log("[Migrate] Skipped (RUN_MIGRATIONS=false)");
  }

  app.listen(PORT, HOST, () => {
    const googleOk = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID);
    console.log(`[API] Murandasi Shop listening on http://${HOST}:${PORT}`);
    console.log(`[API] Health: http://127.0.0.1:${PORT}/api/health`);
    console.log(`[API] Google sign-in: ${googleOk ? "configured" : "MISSING GOOGLE_CLIENT_ID"}`);
    console.log(`[API] OpenAI chat: ${process.env.OPENAI_API_KEY ? "configured" : "MISSING OPENAI_API_KEY"}`);
    const callback = getCallbackTarget();
    if (callback.ok) {
      console.log(`[API] IntouchPay callback: ${callback.url} (from ${callback.source})`);
    } else {
      console.warn(
        `[API] IntouchPay callback NOT reachable${callback.rejected ? ` (${callback.rejected})` : ""} — run \`npm run tunnel\` or set INTOUCHPAY_PUBLIC_BASE_URL`,
      );
    }
    if (fs.existsSync(path.join(distDir, "index.html"))) {
      console.log(`[API] Serving SPA from ${distDir}`);
    }
  });

  // Enforce the three-day delivery confirmation window even when nobody opens
  // the account page. The first run also cleans up expired records after restart.
  const expireCashback = () =>
    expirePendingCashback().catch((error) => console.error("[Cashback] expiry job failed", error));
  const releaseFailedWallets = () =>
    releaseWalletsForFailedPayments()
      .then((n) => {
        if (n > 0) console.log(`[Wallet] Returned cashback on ${n} failed payment(s)`);
      })
      .catch((error) => console.error("[Wallet] failed-payment release job failed", error));
  void expireCashback();
  void releaseFailedWallets();
  setInterval(expireCashback, 60 * 60 * 1000).unref();
  setInterval(releaseFailedWallets, 15 * 60 * 1000).unref();
}

void start();
