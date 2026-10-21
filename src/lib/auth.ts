import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";

const COOKIE_NAME = "ispiti_session";
const MAX_AGE = 60 * 60 * 24 * 7;

const secretValue = process.env.AUTH_SECRET;

if (!secretValue && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET nije postavljen. Postavi ga prije deploya.");
}

const secret = new TextEncoder().encode(
  secretValue || "dev-secret-please-change-in-production",
);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "teacher" | "admin";
  iat?: number;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role === "admin" ? "admin" : "teacher",
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Ime i uloga se čitaju iz baze, ne iz starog tokena — promjena imena
  // ili role važi odmah, bez čekanja da sesija istekne.
  const [teacher] = await db
    .select({
      email: teachers.email,
      name: teachers.name,
      role: teachers.role,
      passwordChangedAt: teachers.passwordChangedAt,
    })
    .from(teachers)
    .where(eq(teachers.id, payload.id))
    .limit(1);

  if (!teacher) return null;

  // Token izdat prije promjene lozinke više ne važi.
  const issuedAtMs = typeof payload.iat === "number" ? payload.iat * 1000 : 0;
  if (issuedAtMs + 1000 < teacher.passwordChangedAt.getTime()) return null;

  return {
    id: payload.id,
    email: teacher.email,
    name: teacher.name,
    role: teacher.role === "admin" ? "admin" : "teacher",
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
