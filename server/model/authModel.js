import { query } from "../utils/db.js";
import { uuid } from "../utils/ids.js";
import { hashPassword, comparePassword, signToken } from "../utils/auth.js";
import { ensureWallet } from "../utils/wallet.js";
import { getConnection } from "../utils/db.js";
import { generateReferralCode } from "../utils/referralCode.js";

function referralCode() {
  return generateReferralCode();
}

export async function register({ email, password, full_name }) {
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    email.toLowerCase(),
  ]);
  if (existing.length) throw new Error("Email already registered.");

  const id = uuid();
  const password_hash = await hashPassword(password);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [id, email.toLowerCase(), password_hash],
    );
    await conn.query(
      `INSERT INTO profiles (id, email, full_name, referral_code)
       VALUES (?, ?, ?, ?)`,
      [id, email.toLowerCase(), full_name || null, referralCode()],
    );
    await conn.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'user')",
      [uuid(), id],
    );
    await ensureWallet(conn, id);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const user = { id, email: email.toLowerCase() };
  return { user, token: signToken(user) };
}

export async function login({ email, password }) {
  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [
    email.toLowerCase(),
  ]);
  const user = rows[0];
  if (!user) throw new Error("Invalid email or password.");
  if (user.blocked) throw new Error("Your account has been blocked.");
  if (!user.password_hash) {
    throw new Error("This account uses Google sign-in. Click “Continue with Google”.");
  }
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) throw new Error("Invalid email or password.");
  const safe = { id: user.id, email: user.email };
  return { user: safe, token: signToken(safe) };
}

/**
 * Verify Google ID token and sign in / register.
 * Uses Google's tokeninfo endpoint (aud must match GOOGLE_CLIENT_ID).
 */
export async function loginWithGoogle({ credential }) {
  if (!credential) throw new Error("Missing Google credential.");

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google sign-in is not configured on the server.");

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!res.ok) throw new Error("Invalid Google token.");
  const payload = await res.json();

  if (payload.aud !== clientId) throw new Error("Google token audience mismatch.");
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    throw new Error("Google email is not verified.");
  }

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const googleId = String(payload.sub || "");
  const fullName = payload.name ? String(payload.name) : null;
  const avatarUrl = payload.picture ? String(payload.picture) : null;

  if (!email || !googleId) throw new Error("Google account missing email.");

  // Prefer match by google_id, then by email (link existing account)
  let rows = await query("SELECT * FROM users WHERE google_id = ? LIMIT 1", [googleId]);
  let user = rows[0];

  if (!user) {
    rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    user = rows[0];
    if (user) {
      await query("UPDATE users SET google_id = COALESCE(google_id, ?) WHERE id = ?", [
        googleId,
        user.id,
      ]);
      if (fullName || avatarUrl) {
        await query(
          `UPDATE profiles SET
             full_name = COALESCE(full_name, ?),
             avatar_url = COALESCE(avatar_url, ?)
           WHERE id = ?`,
          [fullName, avatarUrl, user.id],
        );
      }
    }
  }

  if (!user) {
    const id = uuid();
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "INSERT INTO users (id, email, google_id, password_hash) VALUES (?, ?, ?, NULL)",
        [id, email, googleId],
      );
      await conn.query(
        `INSERT INTO profiles (id, email, full_name, avatar_url, referral_code)
         VALUES (?, ?, ?, ?, ?)`,
        [id, email, fullName, avatarUrl, referralCode()],
      );
      await conn.query(
        "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'user')",
        [uuid(), id],
      );
      await ensureWallet(conn, id);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    const safe = { id, email };
    return { user: safe, token: signToken(safe) };
  }

  if (user.blocked) throw new Error("Your account has been blocked.");

  const safe = { id: user.id, email: user.email };
  return { user: safe, token: signToken(safe) };
}

export async function me(userId) {
  const rows = await query("SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1", [
    userId,
  ]);
  return rows[0] || null;
}
