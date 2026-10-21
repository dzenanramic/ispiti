"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { requireAdmin } from "@/lib/guard";

const schema = z.object({
  name: z.string().trim().min(3, "Ime je prekratko.").max(120),
  email: z.string().trim().toLowerCase().email("Email nije ispravan."),
  password: z.string().min(6, "Lozinka mora imati najmanje 6 znakova.").max(100),
});

export type CreateTeacherState = {
  error?: string;
  success?: string;
};

export async function createTeacherAction(
  _previous: CreateTeacherState,
  formData: FormData,
): Promise<CreateTeacherState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neispravan unos." };
  }

  try {
    await db.insert(teachers).values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "teacher",
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Nastavnik sa tim emailom već postoji." };
    }
    return { error: "Nije moguće dodati nastavnika." };
  }

  revalidatePath("/teacher/admin");
  return { success: `Nastavnik ${parsed.data.name} je dodan.` };
}
