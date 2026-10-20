/** Skema SQLite. Dijalankan idempotent (IF NOT EXISTS) setiap kali database dibuka. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  version       INTEGER NOT NULL,
  category_code TEXT NOT NULL,
  type          TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  stem          TEXT NOT NULL,
  options_json  TEXT NOT NULL,
  answer_key    TEXT,
  explanation   TEXT NOT NULL,
  rubric_json   TEXT,
  source        TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'SMA_SMK',
  transcript    TEXT,
  status        TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status, category_code, difficulty);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_number  INTEGER NOT NULL,
  title           TEXT NOT NULL,
  mode            TEXT NOT NULL,
  category_code   TEXT,
  difficulty      TEXT,
  level           TEXT NOT NULL DEFAULT 'SEMUA',
  question_count  INTEGER NOT NULL,
  seed            TEXT NOT NULL,
  status          TEXT NOT NULL,
  last_index      INTEGER NOT NULL DEFAULT 0,
  duration_sec    INTEGER NOT NULL DEFAULT 0,
  time_limit_sec  INTEGER,
  active_since    INTEGER,
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER,
  result_json     TEXT,
  UNIQUE (user_id, session_number)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at);

-- Snapshot soal per sesi: tidak ikut berubah saat bank soal diedit.
CREATE TABLE IF NOT EXISTS session_items (
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  question_id      TEXT NOT NULL,
  question_version INTEGER NOT NULL,
  type             TEXT NOT NULL,
  category_code    TEXT NOT NULL,
  difficulty       TEXT NOT NULL,
  stem             TEXT NOT NULL,
  options_json     TEXT NOT NULL,
  answer_key       TEXT,
  explanation      TEXT NOT NULL,
  rubric_json      TEXT,
  transcript       TEXT,
  response         TEXT,
  flagged          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, position),
  UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS exposures (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  times_seen   INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER,
  last_correct INTEGER,
  PRIMARY KEY (user_id, question_id)
);
`;
