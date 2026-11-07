ALTER TABLE "answers" ADD COLUMN "earned_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "pairs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Postojeći odgovori: prije ovog stupca tačan odgovor je uvijek nosio 1 bod
-- pitanja. Ovo samo usklađuje historiju sa novim načinom sabiranja.
UPDATE "answers" AS a
SET "earned_points" = q."points"
FROM "questions" AS q
WHERE q."id" = a."question_id" AND a."is_correct" = true;
