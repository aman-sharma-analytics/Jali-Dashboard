-- ═══════════════════════════════════════════════════════════════════
--  schema_batches.sql — adds batch + lead type columns to sessions
--  Run this in MySQL Workbench once.
-- ═══════════════════════════════════════════════════════════════════

USE webinar_insights;

-- ── Add batch and lead type columns to sessions ────────────────────
ALTER TABLE sessions
  ADD COLUMN batch_label       VARCHAR(20)  NULL                       AFTER webinar_date,
  ADD COLUMN batch_year        INT          NULL                       AFTER batch_label,
  ADD COLUMN batch_month       INT          NULL                       AFTER batch_year,
  ADD COLUMN batch_week_num    INT          NULL                       AFTER batch_month,
  ADD COLUMN batch_start_date  DATE         NULL                       AFTER batch_week_num,
  ADD COLUMN batch_end_date    DATE         NULL                       AFTER batch_start_date,
  ADD COLUMN lead_type         ENUM('free','paid','unknown') NOT NULL DEFAULT 'unknown' AFTER batch_end_date;

-- ── Index for faster batch + lead queries ──────────────────────────
CREATE INDEX idx_sessions_batch     ON sessions (batch_label);
CREATE INDEX idx_sessions_lead_type ON sessions (lead_type);
CREATE INDEX idx_sessions_batch_lead ON sessions (batch_label, lead_type);

-- ── Verify ─────────────────────────────────────────────────────────
DESCRIBE sessions;
