import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { attempts, sessions } from "@/db/schema";
import {
  finalizeAttempt,
  jsonError,
  type SubmitReason,
} from "@/lib/attempts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as {
    reason?: unknown;
  } | null;

  const [row] = await db
    .select({
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      attemptReason: attempts.submitReason,
      leaveCount: attempts.leaveCount,
      sessionStatus: sessions.status,
      endsAt: sessions.endsAt,
      quizId: sessions.quizId,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(eq(attempts.token, token))
    .limit(1);

  if (!row) return jsonError("Test nije pronađen.", 404);
  if (row.attemptStatus === "submitted") {
    return Response.json({ ok: true, reason: row.attemptReason });
  }
  if (row.sessionStatus === "lobby") return jsonError("Test još nije počeo.", 409);

  // Klijent predaje sa razlogom; server provjerava da razlog ima smisla.
  // `time` prije isteka tretira se kao obična predaja. Ako je klijent
  // prijavio napuštanje a beacon nije stigao, ovdje se upisuje rezerva.
  let reason: SubmitReason =
    body?.reason === "time" || body?.reason === "left"
      ? body.reason
      : "student";

  if (row.sessionStatus === "closed") {
    reason = "closed";
  } else if (row.endsAt && row.endsAt.getTime() < Date.now()) {
    reason = "time";
  } else if (reason === "time") {
    reason = "student";
  } else if (reason === "left" && row.leaveCount === 0) {
    await db
      .update(attempts)
      .set({ leftAt: new Date(), leaveCount: 1 })
      .where(eq(attempts.id, row.attemptId));
  }

  await finalizeAttempt(row.attemptId, row.quizId, reason);
  return Response.json({ ok: true, reason });
}
