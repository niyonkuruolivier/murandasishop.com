/**
 * File logging for the API.
 *
 * Everything written through console.log/info/warn/error still prints to the
 * terminal, and is also appended to a daily file: logs/api-YYYY-MM-DD.log
 * (override the folder with LOG_DIR in .env).
 *
 * Importing this module once (server/index.js) activates it.
 */
import fs from "fs";
import path from "path";
import util from "util";
import { rootDir } from "../loadEnv.js";

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(rootDir, process.env.LOG_DIR)
  : path.join(rootDir, "logs");

fs.mkdirSync(LOG_DIR, { recursive: true });

let stream = null;
let streamDate = "";

function dateStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getStream() {
  const today = dateStamp();
  if (!stream || streamDate !== today) {
    stream?.end();
    streamDate = today;
    stream = fs.createWriteStream(path.join(LOG_DIR, `api-${today}.log`), { flags: "a" });
    stream.on("error", () => {
      stream = null; // disk problem — keep the app alive, terminal output still works
    });
  }
  return stream;
}

export function logToFile(level, args) {
  const line =
    `[${new Date().toISOString()}] [${level.toUpperCase()}] ` +
    args
      .map((a) =>
        typeof a === "string" ? a : util.inspect(a, { depth: 6, breakLength: Infinity }),
      )
      .join(" ") +
    "\n";
  try {
    getStream()?.write(line);
  } catch {
    /* never let logging crash the app */
  }
}

for (const level of ["log", "info", "warn", "error"]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    logToFile(level, args);
  };
}

process.on("uncaughtException", (e) => {
  console.error("[FATAL] uncaughtException", e);
  process.exitCode = 1;
});
process.on("unhandledRejection", (e) => {
  console.error("[FATAL] unhandledRejection", e);
});

/** Express middleware: one line per API/webhook request with status + duration. */
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    logToFile(
      "http",
      [`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`],
    );
  });
  next();
}

console.log(`[API] Logging to ${LOG_DIR}`);
