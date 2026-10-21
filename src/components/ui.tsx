import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { statusLabel } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "border-emerald-200 bg-brand-soft text-brand-dark"
      : status === "lobby"
        ? "border-amber-200 bg-amber-soft text-amber-800"
        : "border-line bg-paper text-muted";

  return (
    <span className={clsx("badge", styles)}>
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-emerald-500"
            : status === "lobby"
              ? "bg-amber-500"
              : "bg-stone-400",
        )}
      />
      {statusLabel(status)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
          {label}
        </p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/50 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper text-muted">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-emerald-200 bg-brand-soft text-brand-dark",
    warning: "border-amber-200 bg-amber-soft text-amber-900",
    danger: "border-red-200 bg-danger-soft text-danger",
  }[tone];

  return (
    <div className={clsx("rounded-xl border px-4 py-3 text-sm", styles)}>{children}</div>
  );
}
