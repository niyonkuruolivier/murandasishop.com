import { query } from "../utils/db.js";

const DEFAULT_DAYS = 3;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

export async function getSettings() {
  const rows = await query("SELECT confirmation_days FROM cashback_settings WHERE id = 1 LIMIT 1");
  const days = Number(rows[0]?.confirmation_days);
  return {
    confirmation_days:
      Number.isFinite(days) && days >= MIN_DAYS ? Math.min(MAX_DAYS, days) : DEFAULT_DAYS,
  };
}

export async function getConfirmationDays() {
  const { confirmation_days } = await getSettings();
  return confirmation_days;
}

export async function updateSettings(input) {
  const raw = Math.floor(Number(input?.confirmation_days));
  const confirmation_days = Math.max(
    MIN_DAYS,
    Math.min(MAX_DAYS, Number.isFinite(raw) ? raw : DEFAULT_DAYS),
  );

  await query(
    `INSERT INTO cashback_settings (id, confirmation_days)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE confirmation_days = VALUES(confirmation_days)`,
    [confirmation_days],
  );

  return getSettings();
}
