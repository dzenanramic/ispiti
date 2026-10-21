"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { changePasswordAction, type PasswordState } from "@/app/actions/account";
import { SubmitButton } from "@/components/SubmitButton";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-sm border border-pencil/40 bg-pencil-wash px-3.5 py-2.5 text-sm text-pencil">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="flex items-start gap-2 rounded-sm border border-forest/30 bg-forest-wash px-3.5 py-2.5 text-sm text-forest-deep">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {state.success}
        </div>
      ) : null}

      <div>
        <label htmlFor="current" className="label">
          Trenutna lozinka
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      <div>
        <label htmlFor="next" className="label">
          Nova lozinka
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
        <p className="mt-1 text-[11px] text-muted">Najmanje 8 znakova.</p>
      </div>
      <div>
        <label htmlFor="repeat" className="label">
          Ponovi novu lozinku
        </label>
        <input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
      </div>

      <SubmitButton className="w-full" pendingLabel="Mijenjam…">
        Promijeni lozinku
      </SubmitButton>
    </form>
  );
}
