import { addColumn } from "../helpers.js";

export const name = "008_shipping_price";

export async function up(conn) {
  await addColumn(conn, "products", "shipping_price", "DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER price");
}
