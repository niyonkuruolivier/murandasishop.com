import { query } from "../utils/db.js";
import { uuid, parseJson } from "../utils/ids.js";
import * as productModel from "./productModel.js";
import { getConnection } from "../utils/db.js";
import { ensureWallet, markOrderPaid } from "../utils/wallet.js";
import { getConfirmationDays } from "./cashbackSettingsModel.js";
import { lineTotal, shippingForLine } from "../utils/shipping.js";
import { parseVariations, unitPriceForSelection, usesVariationPricing } from "../utils/variations.js";

function mapOrder(row) {
  const mapped = {
    ...row,
    items: parseJson(row.items, []),
    total: Number(row.total),
    wallet_applied: Number(row.wallet_applied),
    momo_amount: row.momo_amount == null ? null : Number(row.momo_amount),
    cashback_awarded: Number(row.cashback_awarded),
    delivery_latitude: row.delivery_latitude == null ? null : Number(row.delivery_latitude),
    delivery_longitude: row.delivery_longitude == null ? null : Number(row.delivery_longitude),
  };
  mapped.payment_status = derivePaymentStatus(mapped);
  mapped.delivery_status = deriveDeliveryStatus(mapped);
  return mapped;
}

const PAID_ORDER_STATUSES = new Set([
  "paid",
  "processing",
  "confirmed",
  "approved",
  "shipped",
  "delivered",
  "completed",
]);

export function derivePaymentStatus(order) {
  if (order.status === "cancelled") return "cancelled";
  if (order.paid_at || PAID_ORDER_STATUSES.has(String(order.status))) return "paid";
  return "pending";
}

export function deriveDeliveryStatus(order) {
  if (order.status === "cancelled") return "cancelled";
  if (["delivered", "completed"].includes(String(order.status))) return "delivered";
  if (order.status === "shipped") return "shipped";
  if (["processing", "confirmed", "approved"].includes(String(order.status))) return "processing";
  return "pending";
}

function mergeOrderStatus(paymentStatus, deliveryStatus) {
  if (paymentStatus === "cancelled" || deliveryStatus === "cancelled") return "cancelled";
  if (paymentStatus === "pending") return "pending";
  switch (deliveryStatus) {
    case "processing":
      return "processing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    default:
      return "paid";
  }
}

export async function findPurchasedSlugs(userId) {
  if (!userId) return [];
  const rows = await query(
    `SELECT items, paid_at, status FROM orders
     WHERE user_id = ?
       AND status <> 'cancelled'
       AND (paid_at IS NOT NULL OR status IN ('paid','processing','confirmed','approved','shipped','delivered','completed'))`,
    [userId],
  );
  const slugs = new Set();
  for (const row of rows) {
    for (const item of parseJson(row.items, [])) {
      if (item?.slug) slugs.add(String(item.slug));
    }
  }
  return [...slugs];
}

export async function createCheckout(input) {
  const products = await productModel.findRawBySlugs(input.items.map((i) => i.slug));
  const purchasedSlugs = new Set(
    input.userId ? await findPurchasedSlugs(input.userId) : [],
  );
  const lines = input.items.flatMap((i) => {
    const p = products.find((x) => x.slug === i.slug);
    if (!p) return [];
    const catalogShipping = Number(p.shipping_price) || 0;
    const appliedShipping = shippingForLine(catalogShipping, p.slug, purchasedSlugs);
    const variations = parseVariations(p.variations);
    let unitPrice = Number(p.price) || 0;
    let variationLabel = null;
    if (usesVariationPricing(variations)) {
      const selections = i.variations && typeof i.variations === "object" ? i.variations : {};
      unitPrice = unitPriceForSelection(variations.groups, selections);
      variationLabel = Object.values(selections)
        .map((v) => String(v).trim())
        .filter(Boolean)
        .join(" · ");
    }
    const displayName = variationLabel ? `${p.name} (${variationLabel})` : p.name;
    return [
      {
        slug: p.slug,
        name: displayName,
        image: p.image,
        price: unitPrice,
        shippingPrice: appliedShipping,
        qty: i.qty,
        quantity: i.qty,
        cashbackPercent: Number(p.cashback_percent) || 0,
        variations: i.variations ?? null,
      },
    ];
  });
  if (!lines.length) throw new Error("Products are no longer available.");
  const total = lines.reduce(
    (a, l) => a + lineTotal(l.price, l.shippingPrice, l.qty, l.slug, purchasedSlugs),
    0,
  );
  const id = uuid();
  const requestedWallet = Math.max(0, Number(input.walletAmount) || 0);
  const conn = await getConnection();
  let walletApplied = 0;
  let momoAmount = total;
  try {
    await conn.beginTransaction();
    if (input.userId && requestedWallet > 0) {
      const wallet = await ensureWallet(conn, input.userId);
      const [walletRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
      walletApplied = Math.min(requestedWallet, total, Number(walletRows[0]?.balance) || 0);
      momoAmount = Math.max(0, total - walletApplied);
    }

    await conn.query(
      `INSERT INTO orders
        (id, user_id, customer_name, phone, address, city, country,
         delivery_latitude, delivery_longitude, delivery_location_label,
         payment_method, items, total, wallet_applied, momo_amount, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        input.userId,
        input.customer_name,
        input.phone,
        input.address,
        input.city,
        input.country,
        input.delivery_latitude,
        input.delivery_longitude,
        input.delivery_location_label,
        input.payment_method,
        JSON.stringify(lines),
        total,
        walletApplied,
        momoAmount,
        input.notes,
      ],
    );

    if (walletApplied > 0) {
      const wallet = await ensureWallet(conn, input.userId);
      const [walletRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
      const balanceAfter = Number(walletRows[0]?.balance) - walletApplied;
      await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [balanceAfter, wallet.id]);
      await conn.query(
        `INSERT INTO wallet_transactions
          (id, user_id, order_id, type, amount, balance_after, note)
         VALUES (?, ?, ?, 'used', ?, ?, ?)`,
        [uuid(), input.userId, id, -walletApplied, balanceAfter, "Cashback used at checkout"],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  if (momoAmount <= 0) {
    await markOrderPaid(id, "cashback-wallet");
  }

  return { id, total, walletApplied, momoAmount, status: momoAmount <= 0 ? "success" : "pending" };
}

export async function findMine(userId) {
  const rows = await query(
    `SELECT id,status,total,items,payment_method,created_at,wallet_applied,momo_amount,cashback_awarded,cashback_status,
            delivery_latitude,delivery_longitude,delivery_location_label,shipping_attachment_url,
            delivered_at,delivery_confirmed_at,cashback_deadline
     FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapOrder);
}

export async function findAll() {
  const rows = await query(
    `SELECT o.*,
            (SELECT p.phone FROM payments p WHERE p.order_id = o.id ORDER BY p.created_at DESC LIMIT 1) AS momo_charge_phone
     FROM orders o
     ORDER BY o.created_at DESC`,
  );
  return rows.map(mapOrder);
}

export async function countPending() {
  const rows = await query(
    "SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'",
  );
  return Number(rows[0]?.count || 0);
}

export async function updateStatus(id, status) {
  const next = String(status || "").trim().toLowerCase();
  if (next === "delivered" || next === "completed") {
    const confirmationDays = await getConfirmationDays();
    await query(
      `UPDATE orders
       SET status = ?,
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP(3)),
           cashback_deadline = CASE
             WHEN cashback_status = 'pending_delivery'
             THEN COALESCE(cashback_deadline, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ? DAY))
             ELSE cashback_deadline
           END
       WHERE id = ?`,
      [next, confirmationDays, id],
    );
  } else {
    await query("UPDATE orders SET status = ? WHERE id = ?", [next, id]);
  }
  const rows = await query("SELECT * FROM orders WHERE id = ?", [id]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function updateStatuses(id, { payment_status, delivery_status, shipping_attachment_url }) {
  const rows = await query("SELECT * FROM orders WHERE id = ?", [id]);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const paymentStatus = String(payment_status ?? derivePaymentStatus(order)).toLowerCase();
  const deliveryStatus = String(delivery_status ?? deriveDeliveryStatus(order)).toLowerCase();

  const attachmentInput =
    shipping_attachment_url !== undefined && shipping_attachment_url !== null
      ? String(shipping_attachment_url).trim().slice(0, 512)
      : null;
  const existingAttachment = String(order.shipping_attachment_url || "").trim();
  const attachmentUrl = attachmentInput || existingAttachment;

  if (deliveryStatus === "shipped" && !attachmentUrl) {
    throw new Error("Add a shipping attachment (photo or PDF) before marking as shipped.");
  }

  if (attachmentInput) {
    await query("UPDATE orders SET shipping_attachment_url = ? WHERE id = ?", [attachmentInput, id]);
  }

  if (
    paymentStatus === "pending" &&
    ["processing", "shipped", "delivered"].includes(deliveryStatus)
  ) {
    throw new Error("Mark payment as paid before updating delivery status.");
  }

  if (paymentStatus === "paid" && !order.paid_at) {
    await markOrderPaid(id, "admin-manual");
  }

  if (paymentStatus === "paid") {
    await query(
      `UPDATE payments
       SET status = 'success', failure_reason = NULL, updated_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ? AND provider <> 'intouchpay_deposit'`,
      [id],
    );
  } else if (paymentStatus === "cancelled") {
    await query(
      `UPDATE payments
       SET status = 'failed', failure_reason = COALESCE(failure_reason, 'Order cancelled by admin'),
           updated_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ? AND provider <> 'intouchpay_deposit' AND status <> 'success'`,
      [id],
    );
  } else if (paymentStatus === "pending") {
    await query(
      `UPDATE payments
       SET status = 'pending', failure_reason = NULL, updated_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ? AND provider <> 'intouchpay_deposit' AND status <> 'success'`,
      [id],
    );
  }

  const nextStatus = mergeOrderStatus(paymentStatus, deliveryStatus);
  return updateStatus(id, nextStatus);
}
