"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { requireUser } from "@/lib/guard";

export type PasswordState = {
  error?: string;
  success?: string;
};

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (next.length < 8) {
    return { error: "Nova lozinka mora imati najmanje 8 znakova." };
  }
  if (next !== repeat) {
    return { error: "Nove lozinke se ne poklapaju." };
  }

  const [teacher] = await db
    .select({ id: teachers.id, passwordHash: teachers.passwordHash })
    .from(teachers)
    .where(eq(teachers.id, user.id))
    .limit(1);

  if (!teacher || !(await verifyPassword(current, teacher.passwordHash))) {
    return { error: "Trenutna lozinka nije ispravna." };
  }

  await db
    .update(teachers)
    .set({
      passwordHash: await hashPassword(next),
      passwordChangedAt: new Date(),
    })
    .where(eq(teachers.id, user.id));

  // Zadrži trenutnu sesiju, a sve ostale uređaje odjavi.
  await setSessionCookie(await createSessionToken(user));

  return { success: "Lozinka je promijenjena." };
}
