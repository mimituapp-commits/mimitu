-- ============================================================
-- Mimitu — esquema Postgres (producción)
-- El backend dev usa un store JSON; en producción apuntá DATABASE_URL
-- a Postgres y migrá la capa src/store.js a este esquema.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT DEFAULT '',
  emoji           TEXT DEFAULT '💜',
  password_hash   TEXT,                      -- bcrypt/argon2; NULL si login social
  provider        TEXT DEFAULT 'email',      -- email | google | apple
  linked_providers TEXT[] DEFAULT '{}',
  age_confirmed   BOOLEAN DEFAULT FALSE,
  balance         INTEGER DEFAULT 0,
  earned          INTEGER DEFAULT 0,         -- acumulado (para torneos)
  couple_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS couples (
  id              TEXT PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,       -- invitación / deep link
  status          TEXT DEFAULT 'pending',     -- pending | linked
  premium         BOOLEAN DEFAULT FALSE,
  premium_since   TIMESTAMPTZ,
  premium_until   TIMESTAMPTZ,
  threshold       INTEGER DEFAULT 25,         -- umbral de validación (configurable en premium)
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id          TEXT PRIMARY KEY,
  couple_id   TEXT REFERENCES couples(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT DEFAULT '✨',
  cat         TEXT DEFAULT 'Detalles',
  value       INTEGER NOT NULL,
  custom      BOOLEAN DEFAULT TRUE,
  status      TEXT DEFAULT 'approved',        -- approved | rejected | pending_review
  created_by  TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs (
  id           TEXT PRIMARY KEY,
  couple_id    TEXT REFERENCES couples(id) ON DELETE CASCADE,
  actor_id     TEXT REFERENCES users(id),
  action_name  TEXT,
  emoji        TEXT,
  value        INTEGER,
  note         TEXT DEFAULT '',
  photo_url    TEXT,                           -- URL firmada/temporal del bucket
  status       TEXT DEFAULT 'validated',       -- validated | pending | rejected
  ts           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rewards (
  id           TEXT PRIMARY KEY,
  couple_id    TEXT REFERENCES couples(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  emoji        TEXT DEFAULT '🎁',
  cost         INTEGER NOT NULL,
  description  TEXT DEFAULT '',
  proposed_by  TEXT REFERENCES users(id),
  status       TEXT DEFAULT 'pending',         -- pending | ready
  ts           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redemptions (
  id         TEXT PRIMARY KEY,
  couple_id  TEXT REFERENCES couples(id) ON DELETE CASCADE,
  reward_id  TEXT REFERENCES rewards(id),
  user_id    TEXT REFERENCES users(id),
  cost       INTEGER,
  ts         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  code        TEXT UNIQUE,
  ends_at     DATE,
  finished    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tournament_couples (
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  couple_id     TEXT REFERENCES couples(id) ON DELETE CASCADE,
  baseline      INTEGER DEFAULT 0,            -- earned al unirse (parte de cero)
  PRIMARY KEY (tournament_id, couple_id)
);

CREATE TABLE IF NOT EXISTS significant_dates (
  id         TEXT PRIMARY KEY,
  couple_id  TEXT REFERENCES couples(id) ON DELETE CASCADE,
  title      TEXT, emoji TEXT, date DATE, remind_days INTEGER DEFAULT 3, bonus INTEGER DEFAULT 50
);
CREATE TABLE IF NOT EXISTS plans (
  id         TEXT PRIMARY KEY,
  couple_id  TEXT REFERENCES couples(id) ON DELETE CASCADE,
  title      TEXT, emoji TEXT, date DATE, description TEXT, value INTEGER DEFAULT 0, done BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS daily_answers (
  id         TEXT PRIMARY KEY,
  couple_id  TEXT REFERENCES couples(id) ON DELETE CASCADE,
  day_key    TEXT, user_id TEXT REFERENCES users(id), text TEXT, ts TIMESTAMPTZ DEFAULT now(),
  UNIQUE (couple_id, day_key, user_id)
);
CREATE TABLE IF NOT EXISTS feed (
  id         TEXT PRIMARY KEY,
  couple_id  TEXT REFERENCES couples(id) ON DELETE CASCADE,
  type       TEXT, actor_id TEXT, text TEXT, emoji TEXT, value INTEGER, sign TEXT, photo_url TEXT,
  thank      JSONB, ts TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_tokens (
  id        TEXT PRIMARY KEY,
  user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT UNIQUE, platform TEXT, ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_couple ON logs(couple_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_feed_couple ON feed(couple_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_users_couple ON users(couple_id);
