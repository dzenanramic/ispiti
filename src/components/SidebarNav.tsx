"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const items: Item[] = [
  { href: "/teacher", label: "Početna", icon: LayoutDashboard },
  { href: "/teacher/quizzes", label: "Kvizovi", icon: BookOpen },
  { href: "/teacher/classes", label: "Odjeljenja", icon: Users },
  { href: "/teacher/account", label: "Nalog", icon: UserCog },
  { href: "/teacher/admin", label: "Administracija", icon: ShieldCheck, adminOnly: true },
];

export function SidebarNav({
  role,
  variant = "sidebar",
}: {
  role: "teacher" | "admin";
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  return (
    <nav
      className={clsx(
        "relative flex gap-1",
        variant === "sidebar" ? "flex-col" : "overflow-x-auto",
      )}
      aria-label="Glavna navigacija"
    >
      {items
        .filter((item) => !item.adminOnly || role === "admin")
        .map((item) => {
          const active =
            item.href === "/teacher"
              ? pathname === "/teacher"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-link="true"
              aria-current={active ? "page" : undefined}
              className={clsx(
                "inline-flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                variant === "mobile" && "shrink-0",
                active
                  ? "bg-brand-soft text-brand-dark"
                  : "text-muted hover:bg-black/[0.04] hover:text-ink",
              )}
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
