import mysql from "mysql2/promise";
import "../loadEnv.js";
import * as m001 from "./migrations/001-google-auth.js";
import * as m002 from "./migrations/002-user-blocked.js";
import * as m003 from "./migrations/003-referrals.js";
import * as m004 from "./migrations/004-delivery-features.js";
import * as m005 from "./migrations/005-cashback-settings.js";
import * as m006 from "./migrations/006-staff-permissions.js";
import * as m007 from "./migrations/007-slugify-products.js";
import * as m008 from "./migrations/008-shipping-price.js";
import * as m009 from "./migrations/009-shipping-attachment.js";
import * as m010 from "./migrations/010-product-variations.js";
import * as m011 from "./migrations/011-shop-settings.js";

const MIGRATIONS = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011];

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "murandasishop_db",
  });
}

async function ensureMigrationTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB
  `);
}

async function appliedMigrations(conn) {
  const [rows] = await conn.query("SELECT name FROM schema_migrations");
  return new Set(rows.map((r) => r.name));
}

/**
 * Runs pending DB migrations. Safe to call on every server start.
 * Set RUN_MIGRATIONS=false to skip (e.g. read-only replicas).
 */
export async function runMigrations() {
  const conn = await createConnection();
  try {
    await ensureMigrationTable(conn);
    const done = await appliedMigrations(conn);
    let ran = 0;

    for (const migration of MIGRATIONS) {
      if (done.has(migration.name)) continue;
      console.log(`[Migrate] Running ${migration.name}…`);
      await migration.up(conn);
      await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [migration.name]);
      console.log(`[Migrate] Applied ${migration.name}`);
      ran++;
    }

    if (ran === 0) {
      console.log("[Migrate] Database is up to date");
    } else {
      console.log(`[Migrate] Applied ${ran} migration(s)`);
    }
  } finally {
    await conn.end();
  }
}
