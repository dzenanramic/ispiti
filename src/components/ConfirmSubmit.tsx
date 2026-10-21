"use client";

import { clsx } from "clsx";

export function ConfirmSubmit({
  action,
  message,
  children,
  className,
  title,
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className={clsx(className)} title={title}>
        {children}
      </button>
    </form>
  );
}
