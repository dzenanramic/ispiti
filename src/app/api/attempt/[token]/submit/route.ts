import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { attempts, sessions } from "@/db/schema";
import { finalizeAttempt, jsonError } from "@/lib/attempts";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const [row] = await db
    .select({
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      sessionStatus: sessions.status,
      quizId: sessions.quizId,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(eq(attempts.token, token))
    .limit(1);

  if (!row) return jsonError("Test nije pronađen.", 404);
  if (row.attemptStatus === "submitted") return Response.json({ ok: true });
  if (row.sessionStatus === "lobby") return jsonError("Test još nije počeo.", 409);

  await finalizeAttempt(row.attemptId, row.quizId);
  return Response.json({ ok: true });
}
