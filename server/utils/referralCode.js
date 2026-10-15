import { query } from "./db.js";

export function generateReferralCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/** Ensures every signed-in user has a unique referral code (creates profile row if needed). */
export async function ensureReferralCode(userId) {
  const profiles = await query(
    "SELECT referral_code FROM profiles WHERE id = ? LIMIT 1",
    [userId],
  );

  const existing = profiles[0]?.referral_code;
  if (existing) return existing;

  const users = await query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!users.length) return null;

  const email = users[0].email;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      if (profiles.length) {
        await query("UPDATE profiles SET referral_code = ? WHERE id = ?", [code, userId]);
      } else {
        await query(
          "INSERT INTO profiles (id, email, referral_code) VALUES (?, ?, ?)",
          [userId, email, code],
        );
      }
      return code;
    } catch (e) {
      if (e.code !== "ER_DUP_ENTRY") throw e;
    }
  }

  throw new Error("Could not generate a unique referral code.");
}
