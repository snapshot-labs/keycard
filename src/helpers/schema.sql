CREATE TABLE `keys` (
  `key` VARCHAR(256) DEFAULT NULL,
  owner VARCHAR(64) NOT NULL,
  name VARCHAR(32) NOT NULL,
  -- Default tier 3 = Trial (200k/mo). Mirrors DEFAULT_TIER in src/writer.ts.
  -- This default only applies to raw inserts (seed/manual SQL); createNewKey() sets tier=3 explicitly.
  --
  -- Migrating an already-deployed DB is OPTIONAL and not required by this change:
  --   * Existing rows keep their current tier, so live partners are NOT downgraded (intended grandfathering).
  --   * To make the column default 3 going forward, run:
  --       ALTER TABLE `keys` ALTER COLUMN tier SET DEFAULT 3;
  --   * Do NOT bulk-backfill existing keys to 3 — that would downgrade live partners.
  --     To move specific keys onto Trial, target them explicitly, e.g.:
  --       UPDATE `keys` SET tier = 3 WHERE owner IN ('0x...');
  tier TINYINT NOT NULL DEFAULT 3,
  created INT(11) DEFAULT (UNIX_TIMESTAMP()),
  updated INT(11) DEFAULT (UNIX_TIMESTAMP()),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`owner`),
  INDEX `key` (`key`),
  INDEX owner (owner),
  INDEX active (active),
  INDEX created (created)
);

CREATE TABLE reqs (
  `key` VARCHAR(256) NOT NULL,
  app VARCHAR(32) NOT NULL,
  total INT(12) NOT NULL DEFAULT 0,
  last_active INT(11) DEFAULT (UNIX_TIMESTAMP()),
  PRIMARY KEY (`key`, app),
  INDEX total (total)
);

CREATE TABLE reqs_daily (
  `key` VARCHAR(256) NOT NULL,
  app VARCHAR(32) NOT NULL,
  day VARCHAR(32) NOT NULL,
  total INT(12) NOT NULL DEFAULT 0,
  PRIMARY KEY (`key`, day, app),
  INDEX total (total)
);

CREATE TABLE reqs_monthly (
  `key` VARCHAR(256) NOT NULL,
  app VARCHAR(32) NOT NULL,
  month VARCHAR(32) NOT NULL,
  total INT(12) NOT NULL DEFAULT 0,
  PRIMARY KEY (`key`, month, app),
  INDEX total (total),
  INDEX month (month)
);
