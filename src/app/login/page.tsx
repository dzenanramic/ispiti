import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
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
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,1fr)]">
      <section className="flex flex-col justify-between border-rule px-6 py-6 lg:border-r lg:px-14 lg:py-10">
        <Brand href="/login" />

        <div className="mx-auto w-full max-w-[34rem] py-14">
          <h1 className="text-[2.6rem] leading-[1.02] sm:text-[3.4rem]">
            Pet minuta na početku časa,
            <br />
            <span className="italic text-forest">cijelo odjeljenje</span> na istoj
            stranici.
          </h1>
          <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-[1.75] text-ink-soft">
            Nastavnik pripremi pet pitanja iz zadnje lekcije, učenici ih riješe na
            telefonu dok sjedaju, a bodovi se sabiraju u pregledu uspjeha. Bez
            štampanja i bez čekanja do sljedećeg časa.
          </p>

          <dl className="mt-10 max-w-[46ch] border-t border-rule font-sans text-sm">
            <div className="flex justify-between gap-4 border-b border-rule-soft py-2.5">
              <dt className="text-ink-soft">Pitanja</dt>
              <dd className="text-right">tačno/netačno, jedan odgovor, dopuna</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-rule-soft py-2.5">
              <dt className="text-ink-soft">Ulaz</dt>
              <dd className="text-right">kod od šest znakova ili QR na telefonu</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-rule-soft py-2.5">
              <dt className="text-ink-soft">Trajanje</dt>
              <dd className="text-right">pet minuta, tajmer kreće kad ti kažeš</dd>
            </div>
          </dl>
        </div>

        <p className="font-sans text-xs text-muted">
          Školska godina {currentSchoolYear()}
        </p>
      </section>

      <section className="flex flex-col justify-center bg-paper-deep/50 px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-[1.9rem]">Prijava</h2>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            Školskim nalogom koji ti je dodijelio administrator.
          </p>

          <div className="mt-7">
            <LoginForm />
          </div>

          <p className="mt-8 border-t border-rule pt-4 font-sans text-xs leading-relaxed text-muted">
            Nemaš nalog? Obrati se administratoru škole — nalozi se ne otvaraju
            javno.
          </p>
        </div>
      </section>
    </div>
  );
}
