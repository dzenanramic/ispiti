import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { attempts, sessions } from "@/db/schema";
import { jsonError } from "@/lib/attempts";

/**
 * Beleži da je učenik sakrio stranicu tokom aktivnog testa. Ne predaje test —
 * predaja ide tek kad se učenik vrati, da kratak prekid (poruka, poziv) ne bi
 * uništio test. `sendBeacon` stiže i kad preglednik zamrzava stranicu.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const [row] = await db
    .select({
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      leaveCount: attempts.leaveCount,
      sessionStatus: sessions.status,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(eq(attempts.token, token))
    .limit(1);

  if (!row) return jsonError("Test nije pronađen.", 404);
  if (row.attemptStatus === "submitted") {
    return Response.json({ ok: true, submitted: true });
  }
  if (row.sessionStatus !== "active") {
    return Response.json({ ok: true, submitted: false });
  }

  await db
    .update(attempts)
    .set({
      leftAt: new Date(),
      leaveCount: sql`${attempts.leaveCount} + 1`,
    })
    .where(eq(attempts.id, row.attemptId));

  return Response.json({
    ok: true,
    submitted: false,
    leaveCount: row.leaveCount + 1,
  });
}
