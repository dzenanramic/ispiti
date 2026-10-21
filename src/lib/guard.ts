import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./auth";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/teacher");
  return user;
}
