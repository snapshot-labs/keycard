DO $$
DECLARE pk_name text;
BEGIN
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'keys'
    AND constraint_type = 'PRIMARY KEY';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "keys" DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "keys" ADD PRIMARY KEY ("key");--> statement-breakpoint
DROP INDEX "keys_key_idx";--> statement-breakpoint
CREATE INDEX "keys_owner_idx" ON "keys" USING btree ("owner");
