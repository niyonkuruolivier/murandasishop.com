/**
 * CLI: run all pending database migrations.
 */
import { runMigrations } from "../db/runMigrations.js";

runMigrations().catch((error) => {
  console.error("[Migrate] Failed:", error);
  process.exit(1);
});
