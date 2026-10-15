import { addColumn } from "../helpers.js";

export const name = "004_delivery_features";

export async function up(conn) {
  await addColumn(conn, "orders", "delivery_latitude", "DECIMAL(10,7) NULL");
  await addColumn(conn, "orders", "delivery_longitude", "DECIMAL(10,7) NULL");
  await addColumn(conn, "orders", "delivery_location_label", "VARCHAR(255) NULL");
  await addColumn(conn, "orders", "delivered_at", "DATETIME(3) NULL");
  await addColumn(conn, "orders", "delivery_confirmed_at", "DATETIME(3) NULL");
  await addColumn(conn, "orders", "cashback_deadline", "DATETIME(3) NULL");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS saved_locations (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      label VARCHAR(80) NOT NULL DEFAULT 'Delivery location',
      address TEXT NOT NULL,
      city VARCHAR(120) NOT NULL,
      country VARCHAR(120) NOT NULL DEFAULT 'Rwanda',
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_locations_user (user_id, created_at)
    ) ENGINE=InnoDB
  `);

  await conn.query(
    "UPDATE orders SET cashback_status = 'credited' WHERE cashback_status = 'awarded'",
  );
}
