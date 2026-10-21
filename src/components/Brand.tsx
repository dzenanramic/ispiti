import Link from "next/link";
import { clsx } from "clsx";

/**
 * Znak: arabeska uplanjena u četverougao — zidna ploča s rezbarijom, a ne
 * logotip softver-aparata. Rezbarija je jedina ornamentika u aplikaciji.
 */
export function PlaqueMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect
        x="2.6"
        y="2.6"
        width="18.8"
        height="18.8"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="5.6"
        y="5.6"
        width="12.8"
        height="12.8"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.55"
      />
      <path
        d="M12 7.4l3.3 4.6L12 16.6l-3.3-4.6L12 7.4z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="0.95" fill="currentColor" />
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
      className={clsx(
        "inline-flex items-center gap-2.5",
        inverted ? "text-paper" : "text-ink",
      )}
      aria-label="Ispiti — početna"
    >
      <PlaqueMark className={clsx("h-6 w-6", inverted ? "text-paper" : "text-forest")} />
      <span className="text-[1.35rem] font-semibold leading-none tracking-tight">
        Ispiti
      </span>
    </Link>
  );
}
