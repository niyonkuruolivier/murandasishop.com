import * as paymentModel from "../model/paymentModel.js";
import {
  getBalance,
  requestDeposit,
  makeRequestTransactionId,
  isIntouchPayConfigured,
  getCallbackTarget,
  INTOUCHPAY_USERNAME,
  INTOUCHPAY_ACCOUNT_NO,
  INTOUCHPAY_MODE,
} from "../utils/intouchpay.js";
import { query } from "../utils/db.js";
import { uuid as newId } from "../utils/ids.js";
import { ok, fail } from "../utils/response.js";

const uuid = (v) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export async function initiate(req, res) {
  try {
    const orderId = uuid(req.body?.orderId);
    if (!orderId) throw new Error("Invalid order.");
    const phone = String(req.body?.phone ?? "").replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 9) throw new Error("Enter a valid Mobile Money number.");
    return ok(res, await paymentModel.initiate({ orderId, phone }));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function status(req, res) {
  try {
    const paymentId = uuid(req.body?.paymentId ?? req.params.id);
    if (!paymentId) throw new Error("Invalid payment.");
    return ok(res, await paymentModel.getState(paymentId));
  } catch (e) {
    return fail(res, e, 400);
  }
}

/**
 * Acknowledge on the first delivery attempt, then update our records.
 *
 * IntouchPay resends the callback until it sees the expected ack body, so the
 * response must never wait on the database or any other slow work.
 */
export function intouchCallback(req, res) {
  let parsed = null;
  let ack = { message: "success", success: "True", request_id: `ack-${Date.now()}` };

  try {
    ({ parsed, ack } = paymentModel.buildIntouchAck(req));
  } catch (e) {
    console.error("[IntouchPay] callback parse error", e);
  }

  res.status(200).json(ack);

  setImmediate(() => {
    paymentModel
      .processIntouchCallback(parsed)
      .catch((e) => console.error("[IntouchPay] callback processing failed", e));
  });
}

export async function listAll(_req, res) {
  try {
    return ok(res, await paymentModel.listAll());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function remove(req, res) {
  try {
    const id = uuid(req.params.id);
    if (!id) throw new Error("Invalid payment id.");
    return ok(res, await paymentModel.remove(id));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function updateStatus(req, res) {
  try {
    const id = uuid(req.params.id);
    if (!id) throw new Error("Invalid payment id.");
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    if (!status) throw new Error("status is required.");
    return ok(res, await paymentModel.updateAdminStatus(id, status));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function clearHistory(req, res) {
  try {
    const type = String(req.body?.type || req.query?.type || "all").toLowerCase();
    if (!["collections", "deposits", "all"].includes(type)) {
      throw new Error('type must be "collections", "deposits", or "all".');
    }
    return ok(res, await paymentModel.clearHistory(type));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function intouchBalance(_req, res) {
  try {
    if (!isIntouchPayConfigured()) throw new Error("IntouchPay is not configured.");
    const data = await getBalance();
    // Always return body so admin UI can show IntouchPay's own error (e.g. No such user)
    return ok(res, data);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function intouchDeposit(req, res) {
  try {
    if (!isIntouchPayConfigured()) throw new Error("IntouchPay is not configured.");
    const phone = String(req.body?.phone ?? "").replace(/[^\d+]/g, "");
    const amount = Math.round(Number(req.body?.amount) || 0);
    const reason = String(req.body?.reason || "Murandasi payout").slice(0, 120);
    if (phone.replace(/\D/g, "").length < 9) throw new Error("Enter a valid phone number.");
    if (amount < 1) throw new Error("Enter a valid amount.");

    const requestTransactionId = makeRequestTransactionId();
    const result = await requestDeposit({ phone, amount, requestTransactionId, reason });

    const id = newId();
    await query(
      `INSERT INTO payments
        (id, order_id, user_id, provider, phone, amount, external_ref, provider_ref, status, failure_reason, raw_response)
       VALUES (?, NULL, ?, 'intouchpay_deposit', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user?.id ?? null,
        phone,
        amount,
        result.requestTransactionId,
        result.providerRef,
        result.ok ? (result.status === "success" ? "success" : "pending") : "failed",
        result.ok ? null : result.message,
        JSON.stringify(result.raw ?? {}),
      ],
    );

    return ok(res, {
      id,
      ...result,
      amount,
      phone,
    });
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function intouchDeposits(_req, res) {
  try {
    const rows = await query(
      `SELECT * FROM payments WHERE provider = 'intouchpay_deposit'
       ORDER BY created_at DESC LIMIT 200`,
    );
    return ok(
      res,
      rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
    );
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function intouchConfig(_req, res) {
  try {
    const callback = getCallbackTarget();
    return ok(res, {
      configured: isIntouchPayConfigured(),
      username: process.env.INTOUCHPAY_USERNAME || INTOUCHPAY_USERNAME,
      accountNo: process.env.INTOUCHPAY_ACCOUNT_NO || INTOUCHPAY_ACCOUNT_NO,
      mode: INTOUCHPAY_MODE,
      callbackUrl: callback.url,
      callbackSource: callback.source,
      callbackReachable: callback.ok,
      callbackRejected: callback.rejected ?? null,
    });
  } catch (e) {
    return fail(res, e, 500);
  }
}
