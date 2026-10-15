import { query } from "../utils/db.js";
import * as wallet from "../utils/wallet.js";

export async function getBalance(userId) {
  return wallet.getBalance(userId);
}

export async function getTransactions(userId) {
  return query(
    `SELECT * FROM wallet_transactions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
}

export async function redeem(userId, orderId, amount) {
  return wallet.redeemForOrder(userId, orderId, amount);
}

export async function listWallets() {
  return query("SELECT * FROM wallets ORDER BY balance DESC");
}

export async function adminAdjust(userId, amount, note) {
  await wallet.adminAdjust(userId, amount, note);
  return { ok: true };
}

export async function adminReverseCashback(orderId, reason) {
  await wallet.adminReverseCashback(orderId, reason);
  return { ok: true };
}

export async function getTransactionsForUser(userId) {
  return getTransactions(userId);
}
