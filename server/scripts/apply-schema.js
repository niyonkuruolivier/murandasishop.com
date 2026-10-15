/**
 * Applies server/schema.sql to MySQL (creates DB + tables).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = path.join(__dirname, "../schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });
  console.log("Applying MySQL schema...");
  await conn.query(schema);
  await conn.end();
  console.log("Done:", process.env.DB_NAME || "murandasishop_db");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
