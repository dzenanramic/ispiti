import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  attempts,
  classes,
  quizzes,
  sessions,
  studentDevices,
  students,
} from "@/db/schema";
import { jsonError } from "@/lib/attempts";
import { isUniqueViolation } from "@/lib/db-errors";
import { generateToken } from "@/lib/codes";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  cleanDeviceToken,
  clientIp,
  findDeviceBinding,
  findStudentBinding,
  listClassDeviceBindings,
} from "@/lib/student-devices";

const claimSchema = z.object({
  studentId: z.string().uuid(),
  // Stariji klijenti šalju token u tijelu; novi koriste HttpOnly kolačić.
  deviceToken: z.string().min(8).max(100).optional(),
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

/** Kolačić je primarni identitet; query/body token ostaje fallback za stare klijente. */
function resolveDeviceToken(
  request: NextRequest,
  fallback?: string | null,
): string {
  return (
    cleanDeviceToken(request.cookies.get(DEVICE_COOKIE)?.value) ??
    cleanDeviceToken(fallback) ??
    generateToken()
  );
}

function respond(
  body: unknown,
  status: number,
  deviceToken: string,
  request: NextRequest,
): NextResponse {
  const response = NextResponse.json(body, { status });
  if (cleanDeviceToken(request.cookies.get(DEVICE_COOKIE)?.value) !== deviceToken) {
    response.cookies.set(DEVICE_COOKIE, deviceToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }
  return response;
}

function deviceError(
  message: string,
  status: number,
  deviceToken: string,
  request: NextRequest,
) {
  return respond({ error: message }, status, deviceToken, request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const deviceToken = resolveDeviceToken(
    request,
    request.nextUrl.searchParams.get("device"),
  );

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

  const bindingRows = await listClassDeviceBindings(session.classId);

  const taken = new Set(attemptRows.map((attempt) => attempt.studentId));
  const mine = attemptRows.find(
    (attempt) => attempt.deviceToken === deviceToken,
  );
  const myBinding = bindingRows.find(
    (binding) => binding.deviceToken === deviceToken,
  );
  const boundStudentIds = new Set(
    bindingRows.map((binding) => binding.studentId),
  );

  return respond(
    {
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
      // Klijent upisuje isti token u localStorage; kolačić ostaje skriven.
      deviceToken,
      boundStudentId: myBinding?.studentId ?? null,
      students: studentRows.map((student) => ({
        id: student.id,
        name: student.name,
        taken: taken.has(student.id),
        // Ime je vezano za drugi uređaj — ovaj telefon ga ne smije preuzeti.
        boundElsewhere:
          boundStudentIds.has(student.id) &&
          myBinding?.studentId !== student.id,
      })),
      me: mine
        ? { token: mine.token, studentId: mine.studentId, status: mine.status }
        : null,
    },
    200,
    deviceToken,
    request,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  const deviceToken = resolveDeviceToken(
    request,
    parsed.success ? parsed.data.deviceToken : null,
  );

  if (!parsed.success) {
    return deviceError("Neispravan zahtjev.", 400, deviceToken, request);
  }

  const session = await loadSession(code);
  if (!session) {
    return deviceError("Test sa tim kodom ne postoji.", 404, deviceToken, request);
  }
  if (session.status === "closed") {
    return deviceError("Test je završen.", 410, deviceToken, request);
  }
  if (session.joinLocked) {
    return deviceError(
      "Nastavnik je zaključao ulaz u test.",
      410,
      deviceToken,
      request,
    );
  }
  if (
    session.status === "active" &&
    session.endsAt &&
    session.endsAt.getTime() < Date.now()
  ) {
    return deviceError(
      "Vrijeme za ovaj test je isteklo.",
      410,
      deviceToken,
      request,
    );
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

  if (!student) {
    return deviceError("Učenik nije u ovom odjeljenju.", 404, deviceToken, request);
  }

  const [bindingByDevice, bindingByStudent] = await Promise.all([
    findDeviceBinding(session.classId, deviceToken),
    findStudentBinding(session.classId, student.id),
  ]);

  // Već prijavljen na ovom uređaju u ovoj sesiji.
  const [byDevice] = await db
    .select({ token: attempts.token, studentId: attempts.studentId })
    .from(attempts)
    .where(
      and(
        eq(attempts.sessionId, session.sessionId),
        eq(attempts.deviceToken, deviceToken),
      ),
    )
    .limit(1);

  if (byDevice) {
    if (byDevice.studentId !== student.id) {
      return deviceError(
        "Ovaj uređaj je već prijavljen kao drugo ime u ovom testu. Javi se nastavniku.",
        409,
        deviceToken,
        request,
      );
    }

    // Stariji pokušaj bez trajne veze — veži ga sada za buduće testove.
    if (bindingByDevice) {
      await db
        .update(studentDevices)
        .set({ lastSeenAt: new Date(), lastIpAddress: clientIp(request) })
        .where(eq(studentDevices.id, bindingByDevice.id));
    } else if (!bindingByStudent) {
      await db
        .insert(studentDevices)
        .values({
          classId: session.classId,
          studentId: student.id,
          deviceToken,
          lastIpAddress: clientIp(request),
        })
        .catch(() => {
          // Utrka sa drugim zahtjevom — veza već postoji, dovoljno je vratiti token.
        });
    }

    return respond(
      { token: byDevice.token, deviceToken },
      200,
      deviceToken,
      request,
    );
  }

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
    return deviceError(
      "Ovo ime je već zauzeto na drugom uređaju. Javi se nastavniku.",
      409,
      deviceToken,
      request,
    );
  }

  // Trajna veza: uređaj ne može mijenjati ime, a ni ime ne može na drugi uređaj.
  if (bindingByDevice && bindingByDevice.studentId !== student.id) {
    return deviceError(
      "Ovaj uređaj je vezan za drugo ime. Javi se nastavniku da oslobodi uređaj.",
      409,
      deviceToken,
      request,
    );
  }
  if (bindingByStudent && bindingByStudent.deviceToken !== deviceToken) {
    return deviceError(
      "Ovo ime je već vezano za drugi uređaj. Javi se nastavniku da oslobodi uređaj.",
      409,
      deviceToken,
      request,
    );
  }

  const token = generateToken();

  try {
    await db.transaction(async (tx) => {
      if (bindingByDevice) {
        await tx
          .update(studentDevices)
          .set({ lastSeenAt: new Date(), lastIpAddress: clientIp(request) })
          .where(eq(studentDevices.id, bindingByDevice.id));
      } else {
        await tx.insert(studentDevices).values({
          classId: session.classId,
          studentId: student.id,
          deviceToken,
          lastIpAddress: clientIp(request),
        });
      }

      await tx.insert(attempts).values({
        sessionId: session.sessionId,
        studentId: student.id,
        deviceToken,
        token,
        status: "joined",
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [retry] = await db
        .select({ token: attempts.token, studentId: attempts.studentId })
        .from(attempts)
        .where(
          and(
            eq(attempts.sessionId, session.sessionId),
            eq(attempts.deviceToken, deviceToken),
          ),
        )
        .limit(1);

      if (retry) {
        if (retry.studentId !== student.id) {
          return deviceError(
            "Ovaj uređaj je već prijavljen kao drugo ime. Javi se nastavniku.",
            409,
            deviceToken,
            request,
          );
        }
        return respond(
          { token: retry.token, deviceToken },
          200,
          deviceToken,
          request,
        );
      }

      return deviceError(
        "Ovo ime ili uređaj je već zauzet. Javi se nastavniku.",
        409,
        deviceToken,
        request,
      );
    }

    return deviceError(
      "Nije moguće započeti test.",
      500,
      deviceToken,
      request,
    );
  }

  return respond({ token, deviceToken }, 200, deviceToken, request);
}
