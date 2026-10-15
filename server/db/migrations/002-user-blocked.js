import { columnExists } from "../helpers.js";

export const name = "002_user_blocked";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";
  if (!(await columnExists(conn, dbName, "users", "blocked"))) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN blocked TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash",
    );
    console.log("[Migrate] Added users.blocked");
  }
}
