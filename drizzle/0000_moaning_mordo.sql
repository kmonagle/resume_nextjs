CREATE TABLE "click_events" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"referrer" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"short_code" text NOT NULL,
	"target_url" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"max_clicks" integer,
	"click_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "links_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "click_events_link_occurred_idx" ON "click_events" USING btree ("link_id","occurred_at");--> statement-breakpoint
CREATE INDEX "click_events_occurred_idx" ON "click_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "links_created_at_idx" ON "links" USING btree ("created_at");