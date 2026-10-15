/**
 * Adds users.blocked for admin user management.
 * @deprecated Prefer `npm run db:migrate` — runs all pending migrations.
 */
import { runMigrations } from "../db/runMigrations.js";

runMigrations().catch((e) => {
  console.error(e);
  process.exit(1);
});
