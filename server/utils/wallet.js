import { getConnection, query } from "./db.js";
import { uuid } from "./ids.js";

export async function ensureWallet(conn, userId) {
  await conn.query(
    `INSERT INTO wallets (id, user_id, balance) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [uuid(), userId],
  );
  const [rows] = await conn.query("SELECT * FROM wallets WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0];
}

export async function getBalance(userId) {
  const conn = await getConnection();
  try {
    const wallet = await ensureWallet(conn, userId);
    return Number(wallet.balance ?? 0);
  } finally {
    conn.release();
  }
}

export async function redeemForOrder(userId, orderId, amount) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      "SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE",
      [orderId, userId],
    );
    const order = orders[0];
    if (!order) throw new Error("Order not found");
    if (Number(order.wallet_applied) > 0) {
      await conn.commit();
      return Number(order.wallet_applied);
    }

    const wallet = await ensureWallet(conn, userId);
    const [wRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
    const bal = Number(wRows[0].balance ?? 0);
    const useAmt = Math.min(Math.max(Number(amount) || 0, 0), bal, Number(order.total));
    if (useAmt <= 0) {
      await conn.commit();
      return 0;
    }

    const newBal = bal - useAmt;
    await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [newBal, wallet.id]);
    await conn.query(
      `INSERT INTO wallet_transactions (id, user_id, order_id, type, amount, balance_after, note)
       VALUES (?, ?, ?, 'used', ?, ?, ?)`,
      [uuid(), userId, orderId, -useAmt, newBal, "Cashback used at checkout"],
    );
    await conn.query(
      "UPDATE orders SET wallet_applied = ?, momo_amount = ? WHERE id = ?",
      [useAmt, Number(order.total) - useAmt, orderId],
    );
    await conn.query(
      `INSERT INTO notifications (id, user_id, type, title, body, link)
       VALUES (?, ?, 'cashback_used', 'Cashback used', ?, '/account')`,
      [
        uuid(),
        userId,
        `FRW ${Math.round(useAmt).toLocaleString()} has been deducted from your Murandasi Cashback Wallet. Remaining balance: FRW ${Math.round(newBal).toLocaleString()}.`,
      ],
    );
    await conn.commit();
    return useAmt;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function computeCashback(order) {
  const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items || [];
  const momo = Number(order.momo_amount ?? order.total) || 0;
  if (momo <= 0) return 0;
  const subtotal = items.reduce((a, l) => a + Number(l.price || 0) * Number(l.qty || l.quantity || 0), 0);
  if (subtotal <= 0) return 0;
  const gross = items.reduce(
    (a, l) =>
      a +
      (Number(l.price || 0) * Number(l.qty || l.quantity || 0) * Number(l.cashbackPercent || 0)) / 100,
    0,
  );
  return Math.round(gross * Math.min(1, momo / subtotal));
}

export async function markOrderPaid(orderId, reference = null) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    const order = orders[0];
    if (!order) throw new Error("Order not found");
    if (order.paid_at) {
      await conn.commit();
      return Number(order.cashback_awarded || 0);
    }

    const cashback = computeCashback(order);
    await conn.query(
      `UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP(3),
       payment_reference = COALESCE(?, payment_reference),
       cashback_awarded = ?, cashback_status = ?
       WHERE id = ?`,
      [reference, cashback, cashback > 0 ? "pending_delivery" : "none", orderId],
    );

    if (order.user_id) {
      await conn.query(
        `UPDATE profiles
         SET approved_purchases = approved_purchases + 1,
             total_spent = total_spent + ?
         WHERE id = ?`,
        [Number(order.total) || 0, order.user_id],
      );
    }

    // A referred customer qualifies after their first successful purchase.
    // Locking the row makes duplicate payment callbacks harmless.
    if (order.user_id) {
      const [referrals] = await conn.query(
        `SELECT * FROM referrals
         WHERE referred_id = ? AND status = 'pending'
         ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
        [order.user_id],
      );
      const referral = referrals[0];
      if (referral) {
        const referrerWallet = await ensureWallet(conn, referral.referrer_id);
        const [referrerWalletRows] = await conn.query(
          "SELECT * FROM wallets WHERE id = ? FOR UPDATE",
          [referrerWallet.id],
        );
        const referralBalance =
          Number(referrerWalletRows[0]?.balance || 0) + Number(referral.reward_amount || 0);
        await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [
          referralBalance,
          referrerWallet.id,
        ]);
        await conn.query(
          `INSERT INTO wallet_transactions
            (id, user_id, order_id, type, amount, balance_after, note)
           VALUES (?, ?, ?, 'referral', ?, ?, ?)`,
          [
            uuid(),
            referral.referrer_id,
            orderId,
            Number(referral.reward_amount || 0),
            referralBalance,
            "Referral reward for a successful purchase",
          ],
        );
        await conn.query(
          `UPDATE referrals
           SET status = 'rewarded', order_id = ?, rewarded_at = CURRENT_TIMESTAMP(3)
           WHERE id = ?`,
          [orderId, referral.id],
        );
        await conn.query(
          `INSERT INTO notifications (id, user_id, type, title, body, link)
           VALUES (?, ?, 'referral_reward', 'Referral reward received', ?, '/account')`,
          [
            uuid(),
            referral.referrer_id,
            `You earned FRW ${Math.round(Number(referral.reward_amount || 0)).toLocaleString()} because your referral completed a purchase.`,
          ],
        );
      }
    }

    await conn.commit();
    return cashback;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Credit held cashback when the customer confirms delivery. The operation is
 * transactional and idempotent, so refreshing or double-clicking is safe.
 */
export async function confirmOrderDelivery(userId, orderId) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [orderId, userId],
    );
    const order = orders[0];
    if (!order) throw new Error("Order not found.");
    if (order.delivery_confirmed_at) {
      await conn.commit();
      return {
        ok: true,
        status: order.cashback_status,
        cashback: order.cashback_status === "credited" ? Number(order.cashback_awarded || 0) : 0,
      };
    }
    if (order.cashback_status === "credited") {
      await conn.commit();
      return { ok: true, status: "credited", cashback: Number(order.cashback_awarded || 0) };
    }
    if (order.cashback_status === "cancelled") {
      await conn.query(
        `UPDATE orders
         SET status = 'completed',
             delivery_confirmed_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [order.id],
      );
      await conn.commit();
      return { ok: true, status: "none", cashback: 0 };
    }
    if (!["delivered", "completed"].includes(String(order.status))) {
      throw new Error("You can confirm delivery only after your order has been delivered.");
    }
    if (order.status === "completed") {
      throw new Error("This order is already complete.");
    }

    if (
      order.cashback_deadline &&
      new Date(order.cashback_deadline).getTime() < Date.now()
    ) {
      await conn.query(
        `UPDATE orders
         SET cashback_status = 'cancelled', cashback_awarded = 0
         WHERE id = ? AND cashback_status = 'pending_delivery'`,
        [order.id],
      );
      await conn.commit();
      return { ok: false, status: "cancelled", cashback: 0 };
    }

    const cashback = Number(order.cashback_awarded || 0);
    if (cashback > 0 && order.user_id) {
      const wallet = await ensureWallet(conn, order.user_id);
      const [walletRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
      const balanceAfter = Number(walletRows[0]?.balance || 0) + cashback;
      await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [balanceAfter, wallet.id]);
      await conn.query(
        `INSERT INTO wallet_transactions
          (id, user_id, order_id, type, amount, balance_after, note)
         VALUES (?, ?, ?, 'earned', ?, ?, ?)`,
        [uuid(), order.user_id, order.id, cashback, balanceAfter, "Cashback for confirmed delivery"],
      );
      await conn.query(
        `INSERT INTO notifications (id, user_id, type, title, body, link)
         VALUES (?, ?, 'cashback_earned', 'Cashback added', ?, '/account')`,
        [
          uuid(),
          order.user_id,
          `You earned FRW ${Math.round(cashback).toLocaleString()} cashback for confirming delivery.`,
        ],
      );
    }
    await conn.query(
      `UPDATE orders
       SET status = CASE WHEN status = 'delivered' THEN 'completed' ELSE status END,
           delivery_confirmed_at = CURRENT_TIMESTAMP(3),
           cashback_status = CASE WHEN ? > 0 THEN 'credited' ELSE 'none' END
       WHERE id = ?`,
      [cashback, order.id],
    );
    await conn.commit();
    return { ok: true, status: cashback > 0 ? "credited" : "none", cashback };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Return wallet cashback reserved on orders whose MoMo payment failed. */
export async function releaseWalletsForFailedPayments() {
  const rows = await query(
    `SELECT o.id AS order_id, o.user_id
     FROM orders o
     INNER JOIN payments p ON p.order_id = o.id
     WHERE o.paid_at IS NULL
       AND o.wallet_applied > 0
       AND p.status = 'failed'
       AND p.provider = 'intouchpay'`,
  );
  let released = 0;
  for (const row of rows) {
    released += await releaseWalletForOrder(row.user_id, row.order_id);
  }
  return released;
}

/** Return a wallet reservation when the external payment request fails. */
export async function releaseWalletForOrder(userId, orderId) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      "SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
      [orderId, userId],
    );
    const order = orders[0];
    if (!order || order.paid_at || Number(order.wallet_applied || 0) <= 0) {
      await conn.commit();
      return 0;
    }
    const amount = Number(order.wallet_applied);
    const wallet = await ensureWallet(conn, userId);
    const [walletRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
    const balanceAfter = Number(walletRows[0]?.balance || 0) + amount;
    await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [balanceAfter, wallet.id]);
    await conn.query(
      `INSERT INTO wallet_transactions
        (id, user_id, order_id, type, amount, balance_after, note)
       VALUES (?, ?, ?, 'reversed', ?, ?, ?)`,
      [uuid(), userId, orderId, amount, balanceAfter, "Cashback returned because payment failed"],
    );
    await conn.query(
      `INSERT INTO notifications (id, user_id, type, title, body, link)
       VALUES (?, ?, 'cashback_returned', 'Cashback returned', ?, '/account')`,
      [
        uuid(),
        userId,
        `FRW ${Math.round(amount).toLocaleString()} was returned to your wallet because the Mobile Money payment did not complete.`,
      ],
    );
    await conn.query(
      `UPDATE orders
       SET wallet_applied = 0, momo_amount = total
       WHERE id = ?`,
      [orderId],
    );
    await conn.commit();
    return amount;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** Cancel held cashback whose three-day delivery confirmation window expired. */
export async function expirePendingCashback() {
  const result = await query(
    `UPDATE orders
     SET cashback_status = 'cancelled', cashback_awarded = 0
     WHERE cashback_status = 'pending_delivery'
       AND cashback_deadline IS NOT NULL
       AND cashback_deadline < CURRENT_TIMESTAMP(3)`,
  );
  return Number(result?.affectedRows || 0);
}

export async function adminAdjust(userId, amount, note) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const wallet = await ensureWallet(conn, userId);
    const [wRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
    const newBal = Number(wRows[0].balance) + Number(amount);
    if (newBal < 0) throw new Error("Balance cannot go negative.");
    await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [newBal, wallet.id]);
    await conn.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, note)
       VALUES (?, ?, 'adjustment', ?, ?, ?)`,
      [uuid(), userId, Number(amount), newBal, note || "Manual adjustment"],
    );
    await conn.commit();
    return newBal;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function adminReverseCashback(orderId, reason) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
    const order = orders[0];
    if (!order) throw new Error("Order not found");
    const amount = Number(order.cashback_awarded || 0);
    if (amount <= 0 || order.cashback_status === "reversed") {
      await conn.commit();
      return 0;
    }
    if (order.user_id) {
      const wallet = await ensureWallet(conn, order.user_id);
      const [wRows] = await conn.query("SELECT * FROM wallets WHERE id = ? FOR UPDATE", [wallet.id]);
      const newBal = Math.max(0, Number(wRows[0].balance) - amount);
      await conn.query("UPDATE wallets SET balance = ? WHERE id = ?", [newBal, wallet.id]);
      await conn.query(
        `INSERT INTO wallet_transactions (id, user_id, order_id, type, amount, balance_after, note)
         VALUES (?, ?, ?, 'reversed', ?, ?, ?)`,
        [uuid(), order.user_id, orderId, -amount, newBal, reason || "Cashback reversed"],
      );
    }
    await conn.query(
      "UPDATE orders SET cashback_status = 'reversed', cashback_awarded = 0 WHERE id = ?",
      [orderId],
    );
    await conn.commit();
    return amount;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
