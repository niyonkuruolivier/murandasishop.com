import { query } from "../utils/db.js";
import { ok, fail } from "../utils/response.js";

export async function badges(_req, res) {
  try {
    const [orders, payments, wa, users] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'"),
      query("SELECT COUNT(*) AS count FROM payments WHERE status = 'pending'"),
      query("SELECT COUNT(*) AS count FROM whatsapp_purchases WHERE status = 'pending'"),
      query("SELECT COUNT(*) AS count FROM users"),
    ]);
    return ok(res, {
      orders: Number(orders[0]?.count || 0),
      payments: Number(payments[0]?.count || 0),
      whatsapp: Number(wa[0]?.count || 0),
      users: Number(users[0]?.count || 0),
    });
  } catch (e) {
    return fail(res, e, 500);
  }
}
