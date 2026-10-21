import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { QuizEditor } from "@/components/QuizEditor";
import { requireUser } from "@/lib/guard";

export const metadata = { title: "Novi kviz" };

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const user = await requireUser();
  const requested = (await searchParams).classId;

  const classRows = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(user.role === "admin" ? undefined : eq(classes.teacherId, user.id))
    .orderBy(classes.name);

  const requestedClass = classRows.find((cls) => cls.id === requested);
  const initialClassId =
    requestedClass?.id ?? (classRows.length === 1 ? classRows[0].id : null);

  return (
    <QuizEditor
      initial={null}
      classes={classRows}
      initialClassId={initialClassId}
    />
  );
}
