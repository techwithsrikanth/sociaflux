-- SociaFlux marketplace schema (libSQL / SQLite on Turso).
--
-- Hybrid storage: the fields the app filters, sorts or joins on are real
-- columns so SQL can do the work, while the full domain object is kept as JSON
-- in a `data`/`profile` column. That keeps the nested shapes the app already
-- uses (campaign targets, brief assets, creator analytics) without flattening
-- them into dozens of columns.

CREATE TABLE IF NOT EXISTS brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  website     TEXT,
  industry    TEXT,
  category    TEXT,
  profile     TEXT NOT NULL,                    -- BusinessProfile JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS creators (
  handle            TEXT PRIMARY KEY,           -- "@handle", already normalised
  name              TEXT NOT NULL,
  email             TEXT,
  primary_niche     TEXT,
  sub_niches        TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  content_languages TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  country           TEXT,                       -- ISO 3166-1 alpha-2
  state             TEXT,
  city              TEXT,
  open_for_barter   INTEGER NOT NULL DEFAULT 0, -- 0/1
  followers         INTEGER NOT NULL DEFAULT 0,
  package_price     INTEGER NOT NULL DEFAULT 0,
  reel_count        INTEGER NOT NULL DEFAULT 0,
  profile           TEXT NOT NULL,              -- CreatorProfile JSON
  -- Instagram connection. The token is deliberately NOT part of the profile
  -- JSON, so it is never serialised to a browser.
  instagram_user_id TEXT,
  instagram_token   TEXT,
  instagram_token_expires_at TEXT,
  instagram_connected_at     TEXT,
  verified          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_creators_niche   ON creators (primary_niche);
CREATE INDEX IF NOT EXISTS idx_creators_country ON creators (country);
CREATE INDEX IF NOT EXISTS idx_creators_barter  ON creators (open_for_barter);

CREATE TABLE IF NOT EXISTS campaigns (
  id                 TEXT PRIMARY KEY,
  brand_id           TEXT,
  brand_name         TEXT,
  name               TEXT NOT NULL,
  objective          TEXT NOT NULL DEFAULT 'awareness',
  status             TEXT NOT NULL DEFAULT 'open',
  budget             INTEGER NOT NULL DEFAULT 0,
  min_followers      INTEGER NOT NULL DEFAULT 0,
  barter_policy      TEXT NOT NULL DEFAULT 'paid',
  region_requirement TEXT NOT NULL DEFAULT 'preferred',
  posted_at          TEXT,
  data               TEXT NOT NULL,             -- full Campaign JSON
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status, posted_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand  ON campaigns (brand_id);

CREATE TABLE IF NOT EXISTS applications (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL,
  campaign_name  TEXT NOT NULL,
  creator_handle TEXT NOT NULL,
  pitch          TEXT NOT NULL DEFAULT '',
  quoted_price   INTEGER NOT NULL DEFAULT 0,
  open_to_barter INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'applied',
  applied_at     TEXT NOT NULL,
  decided_at     TEXT,
  brand_note     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  -- One live application per creator per campaign.
  UNIQUE (campaign_id, creator_handle)
);

CREATE INDEX IF NOT EXISTS idx_applications_campaign ON applications (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_creator  ON applications (creator_handle);
