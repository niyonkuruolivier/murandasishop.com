export const name = "001_google_auth";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
    [dbName],
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!names.has("google_id")) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN google_id VARCHAR(64) NULL UNIQUE AFTER email",
    );
    console.log("[Migrate] Added users.google_id");
  }

  await conn.query("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL");
}
