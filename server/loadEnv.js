import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });

export { rootDir };
