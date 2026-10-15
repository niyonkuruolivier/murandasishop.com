import { columnExists, tableExists } from "../helpers.js";
import { generateReferralCode } from "../../utils/referralCode.js";

export const name = "003_referrals";

export async function up(conn) {
  const dbName = process.env.DB_NAME || "murandasishop_db";

  if (!(await columnExists(conn, dbName, "profiles", "referral_code"))) {
    await conn.query(
      "ALTER TABLE profiles ADD COLUMN referral_code VARCHAR(32) NULL AFTER total_spent",
    );
    console.log("[Migrate] Added profiles.referral_code");
  }

  if (!(await columnExists(conn, dbName, "profiles", "referred_by"))) {
    await conn.query(
      "ALTER TABLE profiles ADD COLUMN referred_by CHAR(36) NULL AFTER referral_code",
    );
    console.log("[Migrate] Added profiles.referred_by");
  }

  if (!(await tableExists(conn, dbName, "referral_settings"))) {
    await conn.query(`
      CREATE TABLE referral_settings (
        id TINYINT PRIMARY KEY DEFAULT 1,
        reward_amount DECIMAL(14,2) NOT NULL DEFAULT 1000,
        max_rewards_per_referrer INT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `);
    await conn.query(
      "INSERT INTO referral_settings (id, reward_amount, active) VALUES (1, 1000, 1)",
    );
    console.log("[Migrate] Created referral_settings");
  }

  if (!(await tableExists(conn, dbName, "referrals"))) {
    await conn.query(`
      CREATE TABLE referrals (
        id CHAR(36) PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        referrer_id CHAR(36) NOT NULL,
        referred_id CHAR(36) NOT NULL UNIQUE,
        order_id CHAR(36) NULL,
        reward_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        rewarded_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_ref_referrer (referrer_id, created_at)
      ) ENGINE=InnoDB
    `);
    console.log("[Migrate] Created referrals");
  }

  const [missing] = await conn.query(
    `SELECT id, email FROM profiles
     WHERE referral_code IS NULL OR referral_code = ''`,
  );

  for (const row of missing) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode();
      try {
        await conn.query("UPDATE profiles SET referral_code = ? WHERE id = ?", [code, row.id]);
        console.log(`[Migrate] Backfilled referral code for ${row.email || row.id}`);
        break;
      } catch (e) {
        if (e.code !== "ER_DUP_ENTRY") throw e;
      }
    }
  }
}
