"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Kopiraj link",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? (
        <Check className="h-4 w-4 text-forest" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {copied ? "Kopirano" : label}
    </button>
  );
}
