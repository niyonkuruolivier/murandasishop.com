import { referencedColumnSql, tableExists } from "../helpers.js";

export const name = "006_staff_permissions";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";

  await conn.query(`
    ALTER TABLE user_roles
    MODIFY COLUMN role ENUM('admin','staff','user') NOT NULL DEFAULT 'user'
  `);

  if (await tableExists(conn, dbName, "user_permissions")) {
    return;
  }

  const userIdCol = await referencedColumnSql(conn, dbName, "users", "id");

  try {
    await conn.query(`
      CREATE TABLE user_permissions (
        user_id ${userIdCol},
        permission VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id, permission),
        CONSTRAINT fk_perm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[Migrate] Created user_permissions");
  } catch (err) {
    // Legacy cPanel DBs sometimes have users.id types that still reject FK — table without FK.
    if (err?.errno !== 1005 && err?.code !== "ER_CANT_CREATE_TABLE") {
      throw err;
    }
    console.warn("[Migrate] user_permissions FK failed, creating without foreign key:", err.message);
    await conn.query(`
      CREATE TABLE user_permissions (
        user_id ${userIdCol},
        permission VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id, permission),
        INDEX idx_user_permissions_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[Migrate] Created user_permissions (no FK)");
  }
}
