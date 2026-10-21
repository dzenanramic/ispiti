import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "Nalog" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        eyebrow="Nalog"
        title="Podešavanja naloga"
        description="Promijeni lozinku koju si dobio od administratora."
      />

      <div className="grid max-w-3xl gap-5 md:grid-cols-[1fr_1.2fr]">
        <section className="card p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <KeyRound className="h-4 w-4" />
          </span>
          <h2 className="mt-3 text-sm font-semibold">{user.name}</h2>
          <p className="text-xs text-muted">{user.email}</p>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {user.role === "admin" ? "Administrator" : "Nastavnik"} · pristup
            odjeljenjima i kvizovima vezanim za ovaj nalog.
          </p>
          <p className="mt-4 rounded-lg bg-paper/70 px-3 py-2 text-[11px] leading-relaxed text-muted">
            Ako si zaboravio lozinku, administrator je može resetovati bez
            pristupa tvom emailu.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Promjena lozinke</h2>
          <p className="mb-4 mt-0.5 text-xs text-muted">
            Nakon promjene ostaješ prijavljen na ovom uređaju.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
