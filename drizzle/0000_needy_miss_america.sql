CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TABLE "keys" (
	"key" text NOT NULL,
	"owner" "citext" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" smallint DEFAULT 0 NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reqs" (
	"key" text NOT NULL,
	"app" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reqs_key_app_pk" PRIMARY KEY("key","app")
);
--> statement-breakpoint
CREATE TABLE "reqs_daily" (
	"key" text NOT NULL,
	"app" text NOT NULL,
	"day" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reqs_daily_key_day_app_pk" PRIMARY KEY("key","day","app")
);
--> statement-breakpoint
CREATE TABLE "reqs_monthly" (
	"key" text NOT NULL,
	"app" text NOT NULL,
	"month" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reqs_monthly_key_month_app_pk" PRIMARY KEY("key","month","app")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "keys_key_idx" ON "keys" USING btree ("key");