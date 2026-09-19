-- Hand-edited from the generated migration. A bare "ADD COLUMN ... NOT NULL"
-- fails when rows already exist, so: add with a temporary default (existing rows
-- become owned by the placeholder 'legacy'), then drop the default so no backend
-- can ever insert a link without saying who owns it.
ALTER TABLE "links" ADD COLUMN "owner_id" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "links_owner_created_idx" ON "links" USING btree ("owner_id","created_at");
