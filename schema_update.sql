-- ═══════════════════════════════════════════════════════════════════
--  schema_update.sql
--
--  Run this in MySQL Workbench to update your existing tables.
--  This fixes the insights_json columns to match what insights.js
--  actually produces, and adds webinar_date to sessions.
--
--  HOW TO RUN:
--  Open MySQL Workbench → paste this → Ctrl+Shift+Enter
-- ═══════════════════════════════════════════════════════════════════

USE webinar_insights;

-- ── Add webinar_date to sessions ────────────────────────────────────
-- Stores the date the user selects in the upload form (not the
-- upload timestamp — the actual webinar date).
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS webinar_date DATE NULL AFTER user_name;

-- ── Drop and recreate insights_json with correct columns ────────────
-- The old columns (phases, retention_funnel, pain_points etc) were
-- wrong — they don't match what insights.js actually returns.
-- The correct columns are: concurrent_curve, live_count, segments,
-- lateness, countries, chat_topics, top_chatters, chat_per5.

DROP TABLE IF EXISTS insights_json;

CREATE TABLE insights_json (
  id               INT  NOT NULL AUTO_INCREMENT,
  session_id       INT  NOT NULL,

  -- From insights.js return object
  concurrent_curve JSON,   -- ins.concurrentCurve  [{min, active, clock}]
  live_count       JSON,   -- ins.liveCount         [{time, count, min}]
  segments         JSON,   -- ins.segments          [{segment, range, count, pct}]
  lateness         JSON,   -- ins.lateness          [{bucket, range, count}]
  countries        JSON,   -- ins.countries         [{name, count}]
  chat_topics      JSON,   -- ins.chat.topics       [{key, label, count, messageIndexes}]
  top_chatters     JSON,   -- ins.chat.topChatters  [{name, count}]
  chat_per5        JSON,   -- ins.chat.chatPer5     [{min, messages, clock}]

  PRIMARY KEY (id),
  CONSTRAINT fk_insights_session
    FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
