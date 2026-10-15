import { query } from "../utils/db.js";
import { uuid, parseJson } from "../utils/ids.js";
import {
  isIntouchPayConfigured,
  makeRequestTransactionId,
  requestPayment,
  getTransactionStatus,
  normalizeIntouchStatus,
  parseCallbackPayload,
  callbackAck,
} from "../utils/intouchpay.js";
import { markOrderPaid, releaseWalletForOrder } from "../utils/wallet.js";

async function releaseWalletOnPaymentFailure(paymentOrOrder) {
  const userId = paymentOrOrder?.user_id;
  const orderId = paymentOrOrder?.order_id ?? paymentOrOrder?.id;
  if (!userId || !orderId) return 0;
  try {
    return await releaseWalletForOrder(userId, orderId);
  } catch (error) {
    console.error("[Wallet] failed to return reserved cashback", error);
    return 0;
  }
}

export async function initiate({ orderId, phone }) {
  const orders = await query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
  const order = orders[0];
  if (!order) throw new Error("Order not found.");

  const due = Math.round(Number(order.momo_amount ?? order.total) || 0);

  if (order.paid_at) {
    return { paymentId: null, orderId: order.id, status: "success", message: null, cashback: 0, amount: due };
  }

  if (due <= 0) {
    const cashback = await markOrderPaid(order.id, "wallet");
    return {
      paymentId: null,
      orderId: order.id,
      status: "success",
      message: null,
      cashback,
      amount: 0,
    };
  }

  if (!isIntouchPayConfigured()) {
    return {
      paymentId: null,
      orderId: order.id,
      status: "not_configured",
      message:
        "IntouchPay is not configured. Add INTOUCHPAY_USERNAME, INTOUCHPAY_PARTNER_PASSWORD and INTOUCHPAY_ACCOUNT_NO to .env.",
      cashback: 0,
      amount: due,
    };
  }

  const paymentId = uuid();
  const requestTransactionId = makeRequestTransactionId();

  await query(
    `INSERT INTO payments
      (id, order_id, user_id, provider, phone, amount, external_ref, status, raw_response)
     VALUES (?, ?, ?, 'intouchpay', ?, ?, ?, 'pending', '{}')`,
    [paymentId, order.id, order.user_id, phone, due, requestTransactionId],
  );

  try {
    const result = await requestPayment({
      phone,
      amount: due,
      requestTransactionId,
    });

    await query(
      `UPDATE payments SET status = ?, provider_ref = ?, failure_reason = ?, raw_response = ?,
       external_ref = ?
       WHERE id = ?`,
      [
        result.ok ? "pending" : "failed",
        result.providerRef,
        result.ok ? null : result.message,
        JSON.stringify(result.raw ?? {}),
        result.requestTransactionId || requestTransactionId,
        paymentId,
      ],
    );

    // Immediate success is rare; usually pending until PIN / callback
    let cashback = 0;
    let status = result.ok ? "pending" : "failed";
    if (result.ok && result.status === "success") {
      status = "success";
      cashback = await markOrderPaid(order.id, result.providerRef ?? requestTransactionId);
      await query("UPDATE payments SET status = 'success' WHERE id = ?", [paymentId]);
    } else if (!result.ok) {
      await releaseWalletOnPaymentFailure(order);
    }

    return {
      paymentId,
      orderId: order.id,
      status,
      message: result.message,
      cashback,
      amount: due,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment request failed.";
    await releaseWalletOnPaymentFailure(order);
    await query("UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?", [
      message,
      paymentId,
    ]);
    return { paymentId, orderId: order.id, status: "failed", message, cashback: 0, amount: due };
  }
}

export async function getState(paymentId) {
  const rows = await query("SELECT * FROM payments WHERE id = ? LIMIT 1", [paymentId]);
  const payment = rows[0];
  if (!payment) throw new Error("Payment not found.");

  let status = payment.status;
  let message = payment.failure_reason;
  let cashback = 0;

  if (status === "pending" && payment.external_ref && payment.provider_ref) {
    const remote = await getTransactionStatus(payment.external_ref, payment.provider_ref);
    console.log("[IntouchPay] poll status", {
      paymentId,
      requestTransactionId: payment.external_ref,
      transactionId: payment.provider_ref,
      mapped: remote?.status,
      responsecode: remote?.responseCode,
      message: remote?.message,
      raw: remote?.raw,
    });
    if (remote && remote.status !== "pending") {
      status = remote.status;
      message = remote.message;
      // Sandbox often auto-flips Pending → Successfull after a few seconds (no PIN).
      // Live IntouchPay only returns success after the customer approves on the phone.
      await query(
        `UPDATE payments SET status = ?, failure_reason = ?, raw_response = ?,
         provider_ref = COALESCE(?, provider_ref) WHERE id = ?`,
        [
          status === "success" ? "success" : "failed",
          remote.status === "failed" ? message : null,
          JSON.stringify(remote.raw ?? {}),
          remote.providerRef,
          payment.id,
        ],
      );
    } else if (remote?.message) {
      message = remote.message;
    }
  }

  if (status === "success" && payment.order_id) {
    cashback = await markOrderPaid(
      payment.order_id,
      payment.provider_ref ?? payment.external_ref ?? undefined,
    );
  } else if (status === "failed") {
    await releaseWalletOnPaymentFailure(payment);
  }

  return {
    paymentId: payment.id,
    orderId: payment.order_id ?? "",
    status,
    message:
      message ||
      (status === "pending"
        ? "Check your phone for the MoMo prompt, or dial *182*7*1# to approve."
        : null),
    cashback,
    amount: Number(payment.amount) || 0,
  };
}

/**
 * Read the webhook body and build the acknowledgement IntouchPay expects.
 * Deliberately synchronous and DB-free so the very first delivery attempt can
 * be acknowledged instantly — an unacknowledged callback is retried 4-5 times.
 */
export function buildIntouchAck(req) {
  const parsed = parseCallbackPayload(req);
  const requestTransactionId = parsed?.requestTransactionId || "";

  console.log("[IntouchPay] callback received", {
    requestTransactionId,
    transactionId: parsed?.transactionId,
    responseCode: parsed?.responseCode,
    status: parsed?.status,
    statusDesc: parsed?.statusDesc,
    raw: parsed?.raw ?? req.body,
  });

  return {
    parsed,
    ack: callbackAck(requestTransactionId || `ack-${Date.now()}`),
  };
}

/**
 * Apply a webhook result to our records. Runs after the acknowledgement and is
 * idempotent, so the duplicate deliveries IntouchPay may still send are safe.
 */
export async function processIntouchCallback(parsed) {
  if (!parsed?.requestTransactionId) {
    console.warn("[IntouchPay] callback without requesttransactionid — ignored");
    return { applied: false, reason: "missing_request_transaction_id" };
  }

  const rows = await query("SELECT * FROM payments WHERE external_ref = ? LIMIT 1", [
    parsed.requestTransactionId,
  ]);
  const payment = rows[0];
  if (!payment) {
    console.warn("[IntouchPay] callback: no payment for", parsed.requestTransactionId);
    return { applied: false, reason: "unknown_payment" };
  }

  const mapped = normalizeIntouchStatus(parsed.responseCode, parsed.status);

  // A settled payment never moves back to pending/failed on a late retry.
  if (payment.status === "success" && mapped !== "success") {
    console.log("[IntouchPay] callback ignored — payment already successful", payment.id);
    return { applied: false, reason: "already_successful" };
  }

  await query(
    `UPDATE payments SET status = ?, provider_ref = COALESCE(?, provider_ref),
     failure_reason = ?, raw_response = ? WHERE id = ?`,
    [
      mapped,
      parsed.transactionId,
      mapped === "failed" ? parsed.statusDesc || "Payment failed" : null,
      JSON.stringify(parsed.raw ?? {}),
      payment.id,
    ],
  );

  if (mapped === "success" && payment.order_id) {
    // markOrderPaid short-circuits on already-paid orders, so retries cannot
    // award cashback twice.
    await markOrderPaid(payment.order_id, parsed.transactionId || payment.external_ref);
  } else if (mapped === "failed") {
    await releaseWalletOnPaymentFailure(payment);
  }

  return { applied: true, paymentId: payment.id, status: mapped };
}

export async function listAll() {
  const rows = await query("SELECT * FROM payments ORDER BY created_at DESC LIMIT 200");
  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    raw_response: parseJson(r.raw_response, {}),
  }));
}

/** Admin: manually set a payment row status (collections linked to orders sync via markOrderPaid). */
export async function updateAdminStatus(id, status) {
  const next = String(status || "").trim().toLowerCase();
  if (!["pending", "success", "failed"].includes(next)) {
    throw new Error('Payment status must be "pending", "success", or "failed".');
  }

  const rows = await query("SELECT * FROM payments WHERE id = ? LIMIT 1", [id]);
  const payment = rows[0];
  if (!payment) throw new Error("Payment not found.");

  const failureReason =
    next === "failed" ? payment.failure_reason || "Marked failed by admin" : null;

  await query(
    `UPDATE payments
     SET status = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [next, failureReason, id],
  );

  if (
    next === "success" &&
    payment.order_id &&
    payment.provider !== "intouchpay_deposit"
  ) {
    await markOrderPaid(
      payment.order_id,
      payment.provider_ref || payment.external_ref || "admin-manual",
    );
  } else if (next === "failed") {
    await releaseWalletOnPaymentFailure(payment);
  }

  const updated = await query("SELECT * FROM payments WHERE id = ? LIMIT 1", [id]);
  return {
    ...updated[0],
    amount: Number(updated[0].amount),
    raw_response: parseJson(updated[0].raw_response, {}),
  };
}

/** Delete one payment/deposit history row (admin). Does not change IntouchPay. */
export async function remove(id) {
  const rows = await query("SELECT id FROM payments WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new Error("Payment not found.");
  await query("DELETE FROM payments WHERE id = ?", [id]);
  return { ok: true, id };
}

/**
 * Clear local history.
 * type: "collections" | "deposits" | "all"
 */
export async function clearHistory(type = "all") {
  if (type === "deposits") {
    const result = await query("DELETE FROM payments WHERE provider = 'intouchpay_deposit'");
    return { ok: true, deleted: result?.affectedRows ?? 0, type };
  }
  if (type === "collections") {
    const result = await query("DELETE FROM payments WHERE provider <> 'intouchpay_deposit'");
    return { ok: true, deleted: result?.affectedRows ?? 0, type };
  }
  const result = await query("DELETE FROM payments");
  return { ok: true, deleted: result?.affectedRows ?? 0, type: "all" };
}
