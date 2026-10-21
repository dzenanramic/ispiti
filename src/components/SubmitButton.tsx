"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";

export function SubmitButton({
  children,
  pendingLabel = "Sačekaj…",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx("btn btn-primary", className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
