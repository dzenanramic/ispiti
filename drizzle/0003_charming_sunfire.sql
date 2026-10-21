ALTER TABLE "quizzes" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quizzes_class_idx" ON "quizzes" USING btree ("class_id");
--> statement-breakpoint
-- Postojeće kvizove dodjeljujemo razredu samo ako su korišteni u tačno
-- jednom odjeljenju. Dijeljeni ili nekorišteni ostaju neraspoređeni dok ih
-- nastavnik ne otvori u editoru.
UPDATE "quizzes" AS q
SET "class_id" = sub."class_id"
FROM (
  SELECT "quiz_id", (ARRAY_AGG(DISTINCT "class_id"))[1] AS "class_id"
  FROM "sessions"
  GROUP BY "quiz_id"
  HAVING COUNT(DISTINCT "class_id") = 1
) AS sub
WHERE q."id" = sub."quiz_id" AND q."class_id" IS NULL;
