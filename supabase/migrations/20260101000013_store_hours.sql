-- ============================================================
-- Migration 013 — per-day store hours
-- Adds:
--   • sellers.timezone         (IANA tz string, default Asia/Kolkata)
--   • store_hours table        (one row per seller × day-of-week)
--   • is_store_open(uuid)      (RPC called at order-creation and checkout)
-- ============================================================

-- 1. Timezone column on sellers
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

-- 2. Per-day schedule table
CREATE TABLE IF NOT EXISTS store_hours (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id    uuid        NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  day_of_week  integer     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0 = Sunday … 6 = Saturday (matches JS Date.getDay() and Postgres EXTRACT(dow))
  is_closed    boolean     NOT NULL DEFAULT false,
  opens_at     time,       -- NULL → open from midnight (no morning gate)
  closes_at    time,       -- NULL → no closing time (open all day)
  UNIQUE (seller_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_store_hours_seller ON store_hours(seller_id);

-- 3. Row-Level Security
ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;

-- Approved sellers' hours are readable by anyone (shown at checkout to buyers).
-- The owning seller can also read their own draft hours before approval.
DROP POLICY IF EXISTS "store_hours_read" ON store_hours;
CREATE POLICY "store_hours_read" ON store_hours
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sellers s
      WHERE s.id = store_hours.seller_id
        AND (s.status = 'approved' OR s.owner_id = auth.uid())
    )
    OR is_admin()
  );

-- Only the store owner (or admin) may insert/update/delete their schedule.
DROP POLICY IF EXISTS "store_hours_write" ON store_hours;
CREATE POLICY "store_hours_write" ON store_hours
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM sellers s WHERE s.id = store_hours.seller_id AND s.owner_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sellers s WHERE s.id = store_hours.seller_id AND s.owner_id = auth.uid())
    OR is_admin()
  );

-- 4. is_store_open(p_seller_id uuid) → boolean
-- Evaluates whether the store is currently open, relative to its own timezone.
--
-- Rules:
--   • If no store_hours rows exist → always open (seller hasn't configured hours yet)
--   • If today has no row          → closed (seller set hours for other days but not this one)
--   • If today's row: is_closed    → closed
--   • opens_at IS NOT NULL and now < opens_at  → closed (before opening time)
--   • closes_at IS NOT NULL and now >= closes_at → closed (after closing time)
--   • Otherwise → open
--
-- Security: SECURITY DEFINER so it can be called from the anon/public
-- Supabase context (same pattern as is_admin()). search_path = public
-- prevents search-path injection.
CREATE OR REPLACE FUNCTION is_store_open(p_seller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone  text;
  local_now   timestamptz;
  local_dow   integer;    -- 0 = Sunday … 6 = Saturday
  local_time  time;
  v_row_count integer;
  r           store_hours%ROWTYPE;
BEGIN
  -- Fetch the seller's timezone
  SELECT timezone INTO v_timezone FROM sellers WHERE id = p_seller_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Compute current local time in the seller's timezone
  local_now  := now() AT TIME ZONE v_timezone;
  local_dow  := EXTRACT(dow FROM local_now)::integer;
  local_time := local_now::time;

  -- If the seller hasn't configured any hours at all, treat as always open
  SELECT COUNT(*) INTO v_row_count
    FROM store_hours
    WHERE seller_id = p_seller_id;

  IF v_row_count = 0 THEN
    RETURN true;
  END IF;

  -- Look up today's schedule row
  SELECT * INTO r
    FROM store_hours
    WHERE seller_id = p_seller_id
      AND day_of_week = local_dow;

  -- No row for today → seller configured some days but left today out → closed
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Explicitly marked closed for the day
  IF r.is_closed THEN
    RETURN false;
  END IF;

  -- Before opening time
  IF r.opens_at IS NOT NULL AND local_time < r.opens_at THEN
    RETURN false;
  END IF;

  -- At or after closing time
  IF r.closes_at IS NOT NULL AND local_time >= r.closes_at THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
