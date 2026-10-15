import { query } from "../utils/db.js";

export async function health(_req, res) {
  const started = Date.now();
  let db = "ok";
  try {
    await query("SELECT 1 AS ok");
  } catch (e) {
    db = e instanceof Error ? e.message : "unreachable";
  }

  const healthy = db === "ok";
  return res.status(healthy ? 200 : 503).json({
    ok: healthy,
    service: "murandasi-api",
    db,
    mode: process.env.INTOUCHPAY_MODE || null,
    uptime: Math.round(process.uptime()),
    ms: Date.now() - started,
  });
}
