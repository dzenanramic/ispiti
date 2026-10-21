import Link from "next/link";
import { clsx } from "clsx";

export function StarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 1.8l2.35 5.36 5.6-2.1-2.1 5.6L23.2 12l-5.35 2.34 2.1 5.6-5.6-2.1L12 23.2l-2.35-5.36-5.6 2.1 2.1-5.6L.8 12l5.35-2.34-2.1-5.6 5.6 2.1L12 1.8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function Brand({
  inverted = false,
  href = "/teacher",
}: {
  inverted?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      data-nav-link="true"
      className={clsx(
        "inline-flex items-center gap-2.5 rounded-xl",
        inverted ? "text-white" : "text-ink",
      )}
      aria-label="Ispiti — početna"
    >
      <span
        className={clsx(
          "grid h-9 w-9 place-items-center rounded-xl",
          inverted ? "bg-white/12 text-white" : "bg-brand text-white",
        )}
      >
        <StarMark className="h-5 w-5" />
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-tight">Ispiti</span>
    </Link>
  );
}
