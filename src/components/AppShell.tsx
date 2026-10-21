"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import { Brand } from "./Brand";
import { NavigationProvider } from "./NavigationProgress";
import { SidebarNav } from "./SidebarNav";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  // Promjena putanje = stigla je nova stranica; gasimo indikator učitavanja.
  const pathname = usePathname();

  return (
    <NavigationProvider>
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white/55 px-4 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>

        <div className="mt-8 flex-1">
          <SidebarNav role={user.role} />
        </div>

        <div className="rounded-2xl border border-line bg-paper/70 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-dark">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted">
                {user.role === "admin" ? "Administrator" : "Nastavnik"}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="btn btn-ghost w-full justify-start !px-2 !py-1.5 text-xs"
            >
              <LogOut className="h-4 w-4" />
              Odjava
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Odjava"
                className="btn btn-ghost !min-h-9 !p-2"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
          <div className="px-2 pb-2">
            <SidebarNav role={user.role} variant="mobile" />
          </div>
        </header>

        <main
          key={pathname}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-[fade-in_180ms_ease-out]"
        >
          {children}
        </main>
      </div>
    </div>
    </NavigationProvider>
  );
}
