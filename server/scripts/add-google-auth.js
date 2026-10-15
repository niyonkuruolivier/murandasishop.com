/**
 * Adds Google auth columns without wiping existing data.
 * @deprecated Prefer `npm run db:migrate` — runs all pending migrations.
 */
import { runMigrations } from "../db/runMigrations.js";

runMigrations().catch((e) => {
  console.error(e);
  process.exit(1);
});
