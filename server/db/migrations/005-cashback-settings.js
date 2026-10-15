import { tableExists } from "../helpers.js";

export const name = "005_cashback_settings";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";

  if (!(await tableExists(conn, dbName, "cashback_settings"))) {
    await conn.query(`
      CREATE TABLE cashback_settings (
        id TINYINT PRIMARY KEY DEFAULT 1,
        confirmation_days INT NOT NULL DEFAULT 3,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `);
    await conn.query("INSERT INTO cashback_settings (id, confirmation_days) VALUES (1, 3)");
    console.log("[Migrate] Created cashback_settings");
  }
}
