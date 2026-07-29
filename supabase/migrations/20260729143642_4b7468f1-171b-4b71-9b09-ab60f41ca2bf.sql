ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reward_cycle_start integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gifts_claimed integer NOT NULL DEFAULT 0;