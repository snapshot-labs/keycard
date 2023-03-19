CREATE TABLE `keys` (
  `key` VARCHAR(256) DEFAULT NULL,
  owner VARCHAR(64) NOT NULL,
  name VARCHAR(32) NOT NULL,
  created INT(11) DEFAULT (UNIX_TIMESTAMP()),
  updated INT(11) DEFAULT (UNIX_TIMESTAMP()),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`owner`),
  INDEX `key` (`key`),
  INDEX owner (owner),
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
  INDEX total (total)
);
