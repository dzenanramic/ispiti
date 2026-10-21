"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type Item = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

const items: Item[] = [
  { href: "/teacher", label: "Početna" },
  { href: "/teacher/quizzes", label: "Kvizovi" },
  { href: "/teacher/classes", label: "Odjeljenja" },
  { href: "/teacher/account", label: "Nalog" },
  { href: "/teacher/admin", label: "Administracija", adminOnly: true },
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
        "flex",
        variant === "sidebar"
          ? "flex-col gap-0.5"
          : "gap-4 overflow-x-auto pb-1 [scrollbar-width:none]",
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

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "font-sans transition-colors",
                variant === "sidebar"
                  ? clsx(
                      "border-l py-[0.3rem] pl-3 text-[0.9375rem] leading-snug",
                      active
                        ? "border-forest text-forest-deep"
                        : "border-transparent text-ink-soft hover:border-rule hover:text-ink",
                    )
                  : clsx(
                      "shrink-0 border-b-2 pb-1 text-sm leading-snug",
                      active
                        ? "border-forest text-forest-deep"
                        : "border-transparent text-ink-soft",
                    ),
              )}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
