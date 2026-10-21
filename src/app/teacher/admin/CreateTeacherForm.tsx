"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createTeacherAction, type CreateTeacherState } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateTeacherForm() {
  const [state, formAction] = useActionState<CreateTeacherState, FormData>(
    createTeacherAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-sm border border-pencil/40 bg-pencil-wash px-3 py-2 text-xs text-pencil">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="flex items-start gap-2 rounded-sm border border-forest/30 bg-forest-wash px-3 py-2 text-xs text-forest-deep">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.success}
        </div>
      ) : null}

      <div>
        <label htmlFor="teacher-name" className="label">
          Ime i prezime
        </label>
        <input
          id="teacher-name"
          name="name"
          required
          className="input"
          placeholder="npr. Amina Karić"
        />
      </div>
      <div>
        <label htmlFor="teacher-email" className="label">
          Email
        </label>
        <input
          id="teacher-email"
          name="email"
          type="email"
          required
          className="input"
          placeholder="ime@skola.ba"
        />
      </div>
      <div>
        <label htmlFor="teacher-password" className="label">
          Početna lozinka
        </label>
        <input
          id="teacher-password"
          name="password"
          type="text"
          required
          minLength={6}
          className="input"
          placeholder="najmanje 6 znakova"
        />
      </div>

      <SubmitButton className="w-full" pendingLabel="Dodajem…">
        Dodaj nastavnika
      </SubmitButton>
    </form>
  );
}
