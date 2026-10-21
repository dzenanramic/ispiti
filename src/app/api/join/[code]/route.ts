import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { attempts, classes, quizzes, sessions, students } from "@/db/schema";
import { jsonError } from "@/lib/attempts";
import { generateToken } from "@/lib/codes";

const claimSchema = z.object({
  studentId: z.string().uuid(),
  deviceToken: z.string().min(8).max(100),
});

async function loadSession(code: string) {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      status: sessions.status,
      joinLocked: sessions.joinLocked,
      code: sessions.code,
      durationSeconds: sessions.durationSeconds,
      endsAt: sessions.endsAt,
      quizTitle: quizzes.title,
      className: classes.name,
      classId: classes.id,
    })
    .from(sessions)
    .innerJoin(quizzes, eq(sessions.quizId, quizzes.id))
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);

  return row ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const deviceToken = request.nextUrl.searchParams.get("device") ?? "";

  const session = await loadSession(code);
  if (!session) return jsonError("Test sa tim kodom ne postoji.", 404);

  const studentRows = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(and(eq(students.classId, session.classId), eq(students.active, true)))
    .orderBy(students.name);

  const attemptRows = await db
    .select({
      studentId: attempts.studentId,
      deviceToken: attempts.deviceToken,
      token: attempts.token,
      status: attempts.status,
    })
    .from(attempts)
    .where(eq(attempts.sessionId, session.sessionId));

  const taken = new Set(attemptRows.map((attempt) => attempt.studentId));
  const mine = deviceToken
    ? attemptRows.find((attempt) => attempt.deviceToken === deviceToken)
    : undefined;

  return Response.json({
    session: {
      code: session.code,
      status: session.status,
      joinLocked: session.joinLocked,
      quizTitle: session.quizTitle,
      className: session.className,
      durationSeconds: session.durationSeconds,
      endsAt: session.endsAt,
      serverNow: Date.now(),
    },
    students: studentRows.map((student) => ({
      id: student.id,
      name: student.name,
      taken: taken.has(student.id),
    })),
    me: mine
      ? { token: mine.token, studentId: mine.studentId, status: mine.status }
      : null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);

  if (!parsed.success) return jsonError("Neispravan zahtjev.");

  const session = await loadSession(code);
  if (!session) return jsonError("Test sa tim kodom ne postoji.", 404);
  if (session.status === "closed") return jsonError("Test je završen.", 410);
  if (session.joinLocked) return jsonError("Nastavnik je zaključao ulaz u test.", 410);
  if (
    session.status === "active" &&
    session.endsAt &&
    session.endsAt.getTime() < Date.now()
  ) {
    return jsonError("Vrijeme za ovaj test je isteklo.", 410);
  }

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.id, parsed.data.studentId),
        eq(students.classId, session.classId),
        eq(students.active, true),
      ),
    )
    .limit(1);

  if (!student) return jsonError("Učenik nije u ovom odjeljenju.", 404);

  const [byDevice] = await db
    .select({ token: attempts.token })
    .from(attempts)
    .where(
      and(
        eq(attempts.sessionId, session.sessionId),
        eq(attempts.deviceToken, parsed.data.deviceToken),
      ),
    )
    .limit(1);

  if (byDevice) return Response.json({ token: byDevice.token });

  const [byStudent] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.sessionId, session.sessionId),
        eq(attempts.studentId, student.id),
      ),
    )
    .limit(1);

  if (byStudent) {
    return jsonError("Ovo ime je već zauzeto na drugom uređaju. Javi se nastavniku.", 409);
  }

  const token = generateToken();

  try {
    await db.insert(attempts).values({
      sessionId: session.sessionId,
      studentId: student.id,
      deviceToken: parsed.data.deviceToken,
      token,
      status: "joined",
    });
  } catch (error) {
    const dbCode = (error as { code?: string }).code;
    if (dbCode === "23505") {
      const [retry] = await db
        .select({ token: attempts.token })
        .from(attempts)
        .where(
          and(
            eq(attempts.sessionId, session.sessionId),
            eq(attempts.deviceToken, parsed.data.deviceToken),
          ),
        )
        .limit(1);
      if (retry) return Response.json({ token: retry.token });
      return jsonError("Ovo ime je već zauzeto. Javi se nastavniku.", 409);
    }
    return jsonError("Nije moguće započeti test.", 500);
  }

  return Response.json({ token });
}
