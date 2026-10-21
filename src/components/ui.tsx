import { clsx } from "clsx";
import { statusLabel } from "@/lib/format";

export function PageHeader({
  meta,
  title,
  description,
  actions,
}: {
  /** Kratka prava informacija (razred, godina, datum), ne dekoracija. */
  meta?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 border-b border-rule pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {meta ? (
            <p className="mb-2 font-sans text-[0.8125rem] text-muted">{meta}</p>
          ) : null}
          <h1 className="text-[2rem] leading-[1.05] sm:text-[2.4rem]">{title}</h1>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-3 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "border-forest/40 text-forest bg-forest-wash"
      : status === "lobby"
        ? "border-rule text-ink-soft bg-transparent"
        : "border-rule-soft text-muted bg-transparent";

  return (
    <span className={clsx("badge", styles)}>
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-forest"
            : status === "lobby"
              ? "bg-muted"
              : "bg-rule",
        )}
      />
      {statusLabel(status)}
    </span>
  );
}

/**
 * Red statistike u jednom pravcu — kao naslovna strana lekcije,
 * a ne četiri jednake kartice.
 */
export function StatRow({
  items,
}: {
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <dl className="rule-top mt-2 grid grid-cols-2 gap-x-6 gap-y-4 py-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="font-sans text-xs text-muted">{item.label}</dt>
          <dd className="mt-1 font-data text-[1.5rem] leading-none">{item.value}</dd>
          {item.hint ? (
            <p className="mt-1 font-sans text-xs text-muted">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-l border-rule py-3 pl-5">
      <h3 className="text-lg">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
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
    info: "border-forest/30 bg-forest-wash text-forest-deep",
    warning: "border-rule bg-ink-wash text-ink",
    danger: "border-pencil/40 bg-pencil-wash text-pencil",
  }[tone];

  return (
    <div
      className={clsx(
        "border-l-2 px-4 py-2.5 font-sans text-sm leading-relaxed",
        styles,
      )}
    >
      {children}
    </div>
  );
}
