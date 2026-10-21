"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Unesi email i lozinku." };
  }

  const [teacher] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.email, email))
    .limit(1);

  if (!teacher || !(await verifyPassword(password, teacher.passwordHash))) {
    return { error: "Pogrešan email ili lozinka." };
  }

  const token = await createSessionToken({
    id: teacher.id,
    email: teacher.email,
    name: teacher.name,
    role: teacher.role === "admin" ? "admin" : "teacher",
  });
  await setSessionCookie(token);
  redirect("/teacher");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
