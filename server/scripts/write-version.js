import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const payload = {
  version: Date.now().toString(36),
  builtAt: new Date().toISOString(),
};

const json = `${JSON.stringify(payload, null, 2)}\n`;

for (const dir of ["public", "dist"]) {
  const target = path.join(rootDir, dir);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "version.json"), json);
}

console.log(`Wrote version.json (${payload.version})`);
