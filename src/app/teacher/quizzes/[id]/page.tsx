import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { questions, quizzes, sessions } from "@/db/schema";
import { QuizEditor } from "@/components/QuizEditor";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Uredi kviz" };

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!quiz) notFound();
  if (user.role !== "admin" && quiz.teacherId !== user.id) {
    redirect("/teacher/quizzes");
  }

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(questions.position);

  const [used] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.quizId, quiz.id))
    .limit(1);

  return (
    <QuizEditor
      initial={{
        id: quiz.id,
        title: quiz.title,
        lesson: quiz.lesson,
        locked: Boolean(used),
        questions: questionRows.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          correct: question.correct,
        })),
      }}
    />
  );
}
