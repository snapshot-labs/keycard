import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

// Case-insensitive text: owner is an eth address compared against the
// checksummed signer from verifyMessage. MySQL's _ci collation matched
// case-insensitively; citext preserves that so mixed-case rows still auth.
const citext = customType<{ data: string }>({ dataType: () => 'citext' });

// Legacy MySQL DATE_FORMAT patterns (%m-%Y, %d-%m-%Y) preserved for data continuity
export const currentMonth = sql`to_char(current_timestamp AT TIME ZONE 'UTC', 'MM-YYYY')`;
export const currentDay = sql`to_char(current_timestamp AT TIME ZONE 'UTC', 'DD-MM-YYYY')`;
export const currentDate = sql`(current_timestamp AT TIME ZONE 'UTC')::date`;

export const keys = pgTable(
  'keys',
  {
    key: text().primaryKey(),
    owner: citext().notNull(),
    name: text().notNull(),
    tier: smallint().notNull().default(0),
    created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    active: boolean().notNull().default(true)
  },
  table => [index('keys_owner_idx').on(table.owner)]
);

export const reqs = pgTable(
  'reqs',
  {
    key: text().notNull(),
    app: text().notNull(),
    total: integer().notNull().default(0),
    last_active: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.key, table.app] })]
);

export const reqsDaily = pgTable(
  'reqs_daily',
  {
    key: text().notNull(),
    app: text().notNull(),
    day: text().notNull(),
    total: integer().notNull().default(0)
  },
  table => [primaryKey({ columns: [table.key, table.day, table.app] })]
);

export const reqsMonthly = pgTable(
  'reqs_monthly',
  {
    key: text().notNull(),
    app: text().notNull(),
    month: text().notNull(),
    total: integer().notNull().default(0)
  },
  table => [
    primaryKey({ columns: [table.key, table.month, table.app] }),
    index('reqs_monthly_month_app_idx').on(table.month, table.app)
  ]
);
