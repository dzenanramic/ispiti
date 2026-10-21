"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div
          role="alert"
          className="border-l-2 border-pencil bg-pencil-wash px-3 py-2 font-sans text-sm text-pencil"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ime@skola.ba"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="input"
        />
      </div>

      <SubmitButton className="mt-2 w-full" pendingLabel="Prijava…">
        Prijavi se
      </SubmitButton>
    </form>
  );
}
