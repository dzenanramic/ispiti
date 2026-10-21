import { redirect } from "next/navigation";
import { BookOpenCheck, QrCode, Timer } from "lucide-react";
import { Brand, StarMark } from "@/components/Brand";
import { getSession } from "@/lib/auth";
import { currentSchoolYear } from "@/lib/format";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Prijava",
};

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/teacher");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex xl:p-14">
        <div className="pattern-dots absolute inset-0 opacity-60" aria-hidden="true" />
        <StarMark className="pointer-events-none absolute -bottom-24 -right-24 h-[26rem] w-[26rem] text-white/[0.055]" />

        <div className="relative">
          <Brand inverted href="/login" />
        </div>

        <div className="relative max-w-md">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            Pet minuta na početku časa
          </p>
          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight xl:text-[2.4rem]">
            Test koji napraviš za pet minuta. Rezultati odmah.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Bez štampanja, bez prepisivanja, bez čekanja do sljedećeg časa. Učenici
            skeniraju kod, ti vidiš ko je šta uradio — dok je lekcija još svježa.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              Pitanja unosiš sam — forma ili uvoz iz teksta
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <QrCode className="h-4 w-4" />
              </span>
              Učenici ulaze skeniranjem QR koda
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <Timer className="h-4 w-4" />
              </span>
              Tajmer kreće tek kad ti pritisneš „Počni“
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/45">
          Školska godina {currentSchoolYear()} · Ispiti
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Brand href="/login" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Prijava</h2>
          <p className="mt-1.5 text-sm text-muted">
            Prijavi se svojim školskim nalogom.
          </p>

          <div className="mt-7">
            <LoginForm />
          </div>

          <p className="mt-8 text-xs leading-relaxed text-muted">
            Nemaš nalog? Obrati se administratoru škole — nalozi se ne otvaraju
            javno.
          </p>
        </div>
      </section>
    </div>
  );
}
