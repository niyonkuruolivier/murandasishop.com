import { addColumn } from "../helpers.js";

export const name = "010_product_variations";

export async function up(conn) {
  await addColumn(conn, "products", "variations", "JSON NULL AFTER specs");
}
