ALTER TABLE "attempts" ADD COLUMN "left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "leave_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "submit_reason" text;