import { query } from "../utils/db.js";
import { uuid } from "../utils/ids.js";
import { ensureReferralCode } from "../utils/referralCode.js";

export async function attach(userId, code) {
  if (!userId) return "unauthenticated";
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) return "invalid";

  const existing = await query("SELECT id FROM referrals WHERE referred_id = ? LIMIT 1", [userId]);
  if (existing.length) return "already_attached";

  const referrers = await query(
    "SELECT id FROM profiles WHERE referral_code = ? LIMIT 1",
    [clean],
  );
  if (!referrers.length) return "not_found";
  if (referrers[0].id === userId) return "self";

  const settings = await query("SELECT reward_amount FROM referral_settings WHERE id = 1 LIMIT 1");
  const reward = Number(settings[0]?.reward_amount ?? 1000);

  await query(
    `INSERT INTO referrals (id, code, referrer_id, referred_id, reward_amount, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [uuid(), clean, referrers[0].id, userId, reward],
  );
  await query("UPDATE profiles SET referred_by = ? WHERE id = ?", [referrers[0].id, userId]);
  return "ok";
}

export async function stats(userId) {
  const code = await ensureReferralCode(userId);
  const settings = await query("SELECT reward_amount FROM referral_settings WHERE id = 1 LIMIT 1");
  const list = await query("SELECT * FROM referrals WHERE referrer_id = ?", [userId]);
  const wallets = await query("SELECT balance FROM wallets WHERE user_id = ? LIMIT 1", [userId]);
  const successful = list.filter((r) => r.status === "rewarded").length;
  const earnings = list
    .filter((r) => r.status === "rewarded")
    .reduce((a, r) => a + Number(r.reward_amount || 0), 0);
  return {
    code,
    total: list.length,
    successful,
    earnings,
    balance: Number(wallets[0]?.balance ?? 0),
    reward_amount: Number(settings[0]?.reward_amount ?? 1000),
  };
}

export async function list(userId) {
  const rows = await query(
    `SELECT r.id, r.status, r.reward_amount, r.rewarded_at, r.created_at, p.full_name AS name
     FROM referrals r
     LEFT JOIN profiles p ON p.id = r.referred_id
     WHERE r.referrer_id = ?
     ORDER BY r.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    reward_amount: Number(r.reward_amount),
    rewarded_at: r.rewarded_at,
    created_at: r.created_at,
  }));
}
