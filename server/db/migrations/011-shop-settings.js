import { tableExists } from "../helpers.js";

export const name = "011_shop_settings";

const DEFAULT_WHATSAPP = "250784254890";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";

  if (!(await tableExists(conn, dbName, "shop_settings"))) {
    await conn.query(`
      CREATE TABLE shop_settings (
        id TINYINT PRIMARY KEY DEFAULT 1,
        whatsapp_phone VARCHAR(32) NOT NULL DEFAULT '${DEFAULT_WHATSAPP}',
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `);
    await conn.query("INSERT INTO shop_settings (id, whatsapp_phone) VALUES (1, ?)", [
      DEFAULT_WHATSAPP,
    ]);
    console.log("[Migrate] Created shop_settings");
  }
}
