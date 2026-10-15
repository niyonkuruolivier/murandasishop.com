/**
 * Adds delivery confirmation, cashback deadlines, and saved locations.
 * @deprecated Prefer `npm run db:migrate` — runs all pending migrations.
 */
import { runMigrations } from "../db/runMigrations.js";

runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
