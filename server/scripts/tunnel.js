/**
 * Exposes the local API on a public HTTPS URL so IntouchPay can deliver real
 * callbacks while developing.
 *
 * The URL is written to .tunnel-url, which the IntouchPay client reads on every
 * payment request — no server restart needed. Delete the file (or stop this
 * script) to fall back to INTOUCHPAY_PUBLIC_BASE_URL / INTOUCHPAY_CALLBACK_URL.
 */
import "../loadEnv.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { rootDir } from "../loadEnv.js";
import { CALLBACK_PATH } from "../utils/intouchpay.js";

const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const TUNNEL_FILE = path.join(rootDir, ".tunnel-url");
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

let published = null;

function publish(url) {
  if (published === url) return;
  published = url;
  fs.writeFileSync(TUNNEL_FILE, url, "utf8");
  console.log("\n" + "=".repeat(72));
  console.log("Public tunnel ready");
  console.log(`  Base URL : ${url}`);
  console.log(`  Callback : ${url}${CALLBACK_PATH}`);
  console.log("");
  console.log("IntouchPay callbacks now reach this machine. Keep this running.");
  console.log("Ask IntouchPay to whitelist the callback URL if required.");
  console.log("=".repeat(72) + "\n");
}

function cleanup() {
  try {
    fs.rmSync(TUNNEL_FILE, { force: true });
  } catch {
    /* ignore */
  }
}

console.log(`Starting public tunnel to http://localhost:${PORT} …`);

// Single command string + shell: Windows refuses to spawn npx.cmd directly and
// rejects an args array passed alongside shell.
const child = spawn(
  `npx -y cloudflared@latest tunnel --url http://localhost:${PORT} --no-autoupdate`,
  { shell: true, stdio: ["ignore", "pipe", "pipe"] },
);

const scan = (chunk) => {
  const text = chunk.toString();
  const match = text.match(URL_PATTERN);
  if (match) publish(match[0]);
  // cloudflared logs every connection at INF level; keep only what matters.
  for (const line of text.split("\n")) {
    if (/\b(ERR|WRN)\b|error|failed/i.test(line)) console.log(line.trim());
  }
};

child.stdout.on("data", scan);
child.stderr.on("data", scan);

child.on("error", (e) => {
  console.error("Failed to start tunnel:", e.message);
  cleanup();
  process.exit(1);
});

child.on("exit", (code) => {
  cleanup();
  console.log(`Tunnel stopped (exit ${code ?? 0}). .tunnel-url removed.`);
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    child.kill();
    process.exit(0);
  });
}
