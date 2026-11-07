import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { studentDevices } from "@/db/schema";

/** Kolačić nosi isti token kao localStorage, ali ga stranica ne može čitati. */
export const DEVICE_COOKIE = "ispiti_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // godina

// UUID ili `dev-...` fallback iz preglednika. Isti oblik koristi i klijent.
const DEVICE_TOKEN_RE = /^[A-Za-z0-9-]{8,100}$/;

export function cleanDeviceToken(
  value: string | null | undefined,
): string | null {
  const token = value?.trim();
  return token && DEVICE_TOKEN_RE.test(token) ? token : null;
}

export type DeviceBinding = {
  id: string;
  studentId: string;
  deviceToken: string;
  lastIpAddress: string | null;
};

/** Veza za konkretan uređaj u odjeljenju. */
export async function findDeviceBinding(
  classId: string,
  deviceToken: string,
): Promise<DeviceBinding | null> {
  const [row] = await db
    .select({
      id: studentDevices.id,
      studentId: studentDevices.studentId,
      deviceToken: studentDevices.deviceToken,
      lastIpAddress: studentDevices.lastIpAddress,
    })
    .from(studentDevices)
    .where(
      and(
        eq(studentDevices.classId, classId),
        eq(studentDevices.deviceToken, deviceToken),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Veza za konkretnog učenika u odjeljenju. */
export async function findStudentBinding(
  classId: string,
  studentId: string,
): Promise<DeviceBinding | null> {
  const [row] = await db
    .select({
      id: studentDevices.id,
      studentId: studentDevices.studentId,
      deviceToken: studentDevices.deviceToken,
      lastIpAddress: studentDevices.lastIpAddress,
    })
    .from(studentDevices)
    .where(
      and(
        eq(studentDevices.classId, classId),
        eq(studentDevices.studentId, studentId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Sve veze u odjeljenju — za spisak u nastavnikovoj konzoli. */
export async function listClassDeviceBindings(classId: string) {
  return db
    .select({
      studentId: studentDevices.studentId,
      deviceToken: studentDevices.deviceToken,
      lastIpAddress: studentDevices.lastIpAddress,
    })
    .from(studentDevices)
    .where(eq(studentDevices.classId, classId));
}

/**
 * IP adresa klijenta. Na produkciji (Vercel/Supabase) ovo je javna adresa
 * koju vidi proxy; u školskoj mreži više uređaja može dijeliti istu.
 * Zato se koristi samo kao podatak za provjeru, nikad kao ključ identiteta.
 */
export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}
