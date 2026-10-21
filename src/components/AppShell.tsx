import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-rule bg-paper-deep/60 px-5 py-6 lg:flex">
        <div>
          <Brand />
          <div className="mt-10">
            <SidebarNav role={user.role} />
          </div>
        </div>

        <div className="border-t border-rule pt-4">
          <p className="truncate text-[0.95rem] leading-tight">{user.name}</p>
          <p className="mt-0.5 font-sans text-xs text-muted">
            {user.role === "admin" ? "Administrator" : "Nastavnik"}
          </p>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 font-sans text-xs text-muted transition-colors hover:text-forest"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
              Odjava
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Odjava"
                className="p-2 text-muted transition-colors hover:text-forest"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </form>
          </div>
          <div className="px-3 pb-2">
            <SidebarNav role={user.role} variant="mobile" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
