/**
 * Generates correctly sized PNG icons required for PWA install on Android/iOS.
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const logoPath = path.join(rootDir, "src/assets/murandasi-logo.webp");
const publicDir = path.join(rootDir, "public");

const bg = { r: 207, g: 207, b: 225, alpha: 1 };
const theme = { r: 14, g: 14, b: 106, alpha: 1 };

async function writeIcon(size, fileName, background, logoSize = size) {
  await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background })
    .extend({
      top: Math.floor((size - logoSize) / 2),
      bottom: Math.ceil((size - logoSize) / 2),
      left: Math.floor((size - logoSize) / 2),
      right: Math.ceil((size - logoSize) / 2),
      background,
    })
    .png()
    .toFile(path.join(publicDir, fileName));
  console.log(`Wrote ${fileName}`);
}

async function main() {
  await writeIcon(192, "pwa-192x192.png", bg);
  await writeIcon(512, "pwa-512x512.png", bg);
  await writeIcon(180, "apple-touch-icon.png", bg);
  await writeIcon(512, "pwa-maskable-512x512.png", theme, 320);
  await sharp(logoPath).resize(64, 64, { fit: "contain", background: bg }).png().toFile(path.join(publicDir, "favicon.png"));
  console.log("Wrote favicon.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
