import { addColumn } from "../helpers.js";

export const name = "009_shipping_attachment";

export async function up(conn) {
  await addColumn(
    conn,
    "orders",
    "shipping_attachment_url",
    "VARCHAR(512) NULL AFTER delivery_location_label",
  );
}
