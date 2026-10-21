import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
