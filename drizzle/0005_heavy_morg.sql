CREATE TABLE "student_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"device_token" text NOT NULL,
	"last_ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_devices" ADD CONSTRAINT "student_devices_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_devices" ADD CONSTRAINT "student_devices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_devices_class_device_idx" ON "student_devices" USING btree ("class_id","device_token");--> statement-breakpoint
CREATE UNIQUE INDEX "student_devices_class_student_idx" ON "student_devices" USING btree ("class_id","student_id");