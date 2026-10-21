# Ispiti

Kratki test za prvih pet minuta časa. Nastavnik pripremi kviz, učenici ga riješe na telefonu preko QR koda, a rezultati su odmah u tabeli — bez štampanja i bez čekanja do sljedećeg časa.

Aplikacija je napravljena za jednu školu i više nastavnika. Pilot predmet je hadis, ali model je generički: bosanski, historija, geografija, arapski i svi ostali predmeti rade isto.

---

## Kako radi

**Nastavnik**

1. Napravi kviz — ručno kroz formu ili zalijepi pitanja iz teksta po šablonu; odmah izabere razred kojem kviz pripada.
2. Sačuva kviz i otvori test u tom razredu (ili to uradi kasnije iz liste kvizova). Dobije kod od 6 znakova i QR kod.
3. Pritisne „Počni test" kada su učenici spremni. Tajmer kreće za sve u istom trenutku.
4. Gleda uživo ko je ušao, ko je predao i koliko bodova ima. Na kraju vidi matricu odgovora po pitanju.

**Učenik**

1. Skenira QR ili otvori link, izabere svoje ime sa spiska.
2. Čeka da nastavnik pokrene test.
3. Odgovara na 5 pitanja, odgovori se čuvaju automatski, predaje test. Vidi samo „predano" — bez tačnih odgovora.

**Ocjena**

Bodovi iz svih testova se sabiraju u pregledu uspjeha odjeljenja. Ocjenu i dalje daje nastavnik — aplikacija je ne upisuje, ne predlaže završnu ocjenu i nije povezana sa e-dnevnikom.

---

## Funkcije (MVP)

- Prijava nastavnika emailom i lozinkom; uloga nastavnik i administrator.
- Odjeljenja sa spiskom učenika (unos lijepljenjem, deaktivacija bez brisanja historije).
- Kvizovi: 1–20 pitanja, 1 bod po pitanju; tipovi:
  - tačno / netačno,
  - jedan tačan odgovor,
  - dopuna iz ponuđenih riječi (word bank — učenik tapne riječ, ne kuca).
- Uvoz pitanja iz teksta po šablonu (vidi ispod).
- Kviz pripada jednom razredu; pokreće se samo u njemu. Za drugo odjeljenje duplikuj kviz i izmijeni pitanja.
- „Sačuvaj i otvori test" odmah pravi lobby sesiju; ako razred već ima otvoren test, nudi se nastavak umjesto drugog koda.
- Sesija: QR + 6-znakovni kod, lobby, sinhronizovani tajmer (3/5/6/10 min), zaključavanje ulaza, produženje vremena, poništavanje pokušaja, ručni upis rezultata za odsutne.
- Učenik bez naloga: ime se veže za uređaj za tu sesiju, jedan pokušaj po učeniku.
- Lokalno čuvanje odgovora: svaki odgovor se upisuje u `localStorage` prije slanja; poslije reloada se vraća i ponovo šalje. Predaja čeka da svi odgovori stignu na server.
- Rezultati uživo, matrica učenik × pitanje, uspješnost po pitanju, štampa i CSV izvoz.
- Arapski tekst i RTL prikaz u pitanjima i ponuđenim odgovorima.
- Mobilni učenički ekran prilagođen telefonu.

### Šablon za uvoz pitanja

Prazan red razdvaja pitanja. Može i bez praznog reda ako pitanja počinju brojem.

```text
1. Koji su osnovni dijelovi hadisa?
A) Isnad i matn
B) Sened i šerh
C) Matn i tefsir
Tačno: A

2. Hadis je riječ, djelo ili odobrenje Poslanika.
Tačno: T

3. Lanac prenosilaca naziva se _____.
Riječi: isnad, matn, šerh, tefsir
Tačno: isnad
```

- `Tačno:` prima `T`/`N`, `Tačno`/`Netačno`, `Da`/`Ne`, ili slovo/number opcije.
- Ako nema opcija i nema riječi, pitanje je tačno/netačno.
- Kod dopune, `Riječi:` je obavezan; ako u tekstu nema `_____`, dodaje se na kraj.

---

## Stack

- Next.js 16 (App Router, Server Actions, Route Handlers), React 19, TypeScript
- Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- Sopstvena autentikacija: bcrypt + JWT u `httpOnly` cookieju (`jose`)
- `qrcode` za QR kod na serveru
- Vercel + Supabase (Postgres) u produkciji

Nema AI generisanja pitanja i nema uvoza `.docx`/PDF-a u MVP-u — nastavnik unosi pitanja sam. To je namjerno: nema rizika da AI izmisli tačan odgovor, a unos 5 pitanja traje nekoliko minuta.

---

## Lokalno pokretanje

Potrebno: Node.js 20.9+, npm, Docker.

```bash
# 1. Postgres na portu 5434 (izbjegava sudar sa lokalnim 5432/5433)
docker run -d --name ispiti-pg \
  -e POSTGRES_USER=ispiti \
  -e POSTGRES_PASSWORD=ispiti \
  -e POSTGRES_DB=ispiti \
  -p 5434:5432 postgres:16-alpine

# 2. Zavisnosti
npm install

# 3. Okruženje
cp .env.example .env.local
# postavi AUTH_SECRET, npr: openssl rand -hex 32

# 4. Šema i demo podaci
npm run db:migrate
npm run db:seed

# 5. Aplikacija
npm run dev
```

Otvori <http://localhost:3000>.

### Demo nalozi

| Uloga | Email | Lozinka |
|---|---|---|
| Nastavnik | `profesor@ispiti.local` | `profesor123` |
| Administrator | `admin@ispiti.local` | `admin123` |

Demo podaci: 3. i 4. razred, po 20 učenika, po dva kviza za svaki razred (različita pitanja), četiri završena testa i otvorena sesija `TEST22` (3. razred) za probu učeničkog toka.

`npm run db:seed -- --reset` briše sve i ponovo puni demo podatke. **Ne pokretati u produkciji.**

### Smoke test (opciono)

Sa pokrenutim `npm run dev` i demo podacima:

```bash
node scripts/e2e.mjs
```

Skripta prolazi cijeli tok (prijava, uvoz pitanja, sesija, učenički ulazak, odgovori, predaja, rezultati, uspjeh, admin) i snima ekrane u `.screenshots/`. Napravi jedan probni kviz i sesiju — ne diraj je u produkciji.

---

## Produkcija: Vercel + Supabase

### 1. Supabase

1. Napravi projekat u EU regionu (npr. Frankfurt).
2. U **Connect** panelu uzmi dvije veze:
   - **Pooler** (transaction mode, port `6543`) → `DATABASE_URL` za aplikaciju.
   - **Direct** (port `5432`) → `DIRECT_URL` samo za migracije.
3. Lozinku baze čuvaj kao tajnu; ne commitaj `.env.local`.

### 2. Migracije i prvi admin

Na svojoj mašini, sa produkcionim `.env.local` (ili privremeno izvezi promjenljive):

```bash
DATABASE_URL="<pooler-url>" \
DIRECT_URL="<direct-url>" \
npm run db:migrate

DATABASE_URL="<pooler-url>" \
npm run db:admin -- admin@skola.ba "jaka-lozinka" "Ime Prezime"
```

Ne pokreći `db:seed` u produkciji — ubacio bi demo učenike i slabe lozinke.

### 3. Vercel

- Import repozitorija; framework se prepoznaje kao Next.js.
- Environment variables:
  - `DATABASE_URL` — Supabase pooler URL (`?sslmode=require`)
  - `AUTH_SECRET` — `openssl rand -hex 32`
  - `NEXT_PUBLIC_APP_URL` — `https://tvoja-adresa.vercel.app` (ili custom domena)
- Deploy.

`NEXT_PUBLIC_APP_URL` određuje šta QR kod kodira. Ako ga ne postaviš, koristi se host iz zahtjeva — ali ga je bolje eksplicitno postaviti, posebno sa custom domenom.

### 4. Održavanje

- Novi nastavnik: administrator ga dodaje u **Administracija → Novi nastavnik**.
- Zaboravljena lozinka: nastavnik je mijenja na **Nalog**, a administrator može resetovati sa:

```bash
DATABASE_URL="<pooler-url>" npm run db:password -- profesor@skola.ba "nova-lozinka"
```

- Supabase free projekat se pauzira poslije oko sedmicu neaktivnosti. Nedjeljna upotreba je na granici; raspust će ga sigurno pauzirati. Probudi se iz Supabase dashboarda jednim klikom. Za ozbiljnu upotrebu uzmi plaćeni plan ili zakazi periodični ping.

---

## Skripte

| Komanda | Šta radi |
|---|---|
| `npm run dev` | Razvojni server |
| `npm run build` / `npm start` | Produkcioni build i server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generiše SQL migraciju iz šeme |
| `npm run db:migrate` | Primjenjuje migracije (`DIRECT_URL` ili `DATABASE_URL`) |
| `npm run db:seed` | Demo podaci (samo lokalno) |
| `npm run db:seed -- --reset` | Briše i ponovo puni demo podatke |
| `npm run db:admin -- email lozinka "Ime"` | Kreira/ažurira administratora |
| `npm run db:password -- email lozinka` | Resetuje lozinku bilo kojeg naloga |
| `npm run db:studio` | Drizzle Studio |

---

## Model podataka

- `teachers` — nalozi, uloga `teacher`/`admin`, bcrypt hash.
- `classes` — odjeljenje, školska godina, nastavnik.
- `students` — učenik u odjeljenju, `active` za meko brisanje.
- `quizzes` / `questions` — sadržaj kviza i razred kojem pripada; pitanja se ne mijenjaju ako je kviz korišten (historija ostaje tačna).
- `sessions` — izvođenje kviza u odjeljenju; kod, status, tajmer, zaključan ulaz.
- `attempts` — jedan pokušaj učenika u sesiji; token uređaja, token pokušaja, bodovi.
- `answers` — odgovor po pitanju, odmah ocijenjen.
- `grades` — ocjene nastavnika, više po polugodištu.

Kviz pripada jednom razredu, a sesija je jedno izvođenje tog kviza. Ako isti sadržaj treba i drugom razredu, kviz se duplikuje — time se pitanja mogu prilagoditi razredu, a historija ostaje jasna.

---

## Sigurnost i ograničenja

- **Identitet učenika nije verifikovan.** Ime se veže za uređaj (localStorage + jedinstveni indeks u bazi) samo za tu sesiju. Učenik može obrisati podatke preglednika ili uzeti drugi telefon; tada ga blokira zauzeto ime, a nastavnik poništava pokušaj. Ovo je dovoljno za rad u učionici, ne za dokazivanje identiteta.
- **Kasni ulazak** je dozvoljen dok nastavnik ne zaključa ulaz ili ne istekne vrijeme. Učenik dobija preostalo vrijeme.
- **Jedan pokušaj** po učeniku po sesiji. Nastavnik može poništiti pokušaj i ručno upisati bodove.
- **Nema djelimičnih bodova**: 1 pitanje = 1 bod; tačno ili netačno.
- **Nema e-dnevnika**, roditeljskog portala ni sinhronizacije sa Google Classroomom.
- **Nema AI-a ni uvoza dokumenata.** Sljedeći korak, ako se pokaže potreba, je da AI predloži pitanja iz `.docx` lekcije, a nastavnik ih pregleda i izmijeni.
- **Nema emaila**: reset lozinke radi administrator preko CLI-ja ili nastavnik preko stranice **Nalog**. Promjena lozinke odjavljuje sve ostale uređaje.
- **Nema service workera**: ako je telefon potpuno offline, sama stranica se ne može učitati. Odgovori ipak ostaju u `localStorage` i vraćaju se čim se stranica učita sa mrežom; predaja se ne izvršava dok odgovori ne stignu na server.
- **Nema brisanja odjeljenja** u UI-u; učenici se deaktiviraju da historija ostane. Podaci se čuvaju do kraja školske godine; za brisanje je potreban SQL/dogovor.
- **QR/kod je namijenjen učionici.** Svako sa kodom može vidjeti spisak imena i pridružiti se; ne dijeliti kod izvan odjeljenja.
- **Supabase free** nije predviđen za ozbiljan produkcioni saobraćaj; za školu je dovoljan, ali provjeri pauziranje i limite.

### Preporuke prije prave upotrebe

1. Promijeni demo lozinke ili obriši demo naloge.
2. Postavi jak `AUTH_SECRET` i provjeri da `.env.local` nije u git-u.
3. Uradi probni test sa jednim odjeljenjem i svojim telefonom prije nego što ocjene uđu u tabelu.
4. Dogovori sa školom ko smije vidjeti imena i rezultate (trenutno: nastavnik odjeljenja i administrator).
5. Napravi CSV izvoz na kraju polugodišta kao kopiju.

---

## Struktura

```text
src/
  app/
    actions/          server actions (auth, classes, quizzes, sessions, admin)
    api/              join, attempt, answer, submit, live, CSV
    j/[code]/         učenički ekran
    login/
    teacher/          dashboard, odjeljenja, kvizovi, sesije, uspjeh, admin, nalog
  components/         AppShell, QuizEditor, SessionConsole, UI
  db/                 schema, klijent, seed, CLI skripte
  lib/                auth, guard, parser pitanja, formatiranje, bodovanje
drizzle/              SQL migracije
```

---

## Roadmap (poslije pilota)

- AI predlog pitanja iz `.docx`/PDF lekcije, sa obaveznim pregledom nastavnika.
- Tip „spoji tačno" i djelimični bodovi.
- Uvoz spiska učenika iz CSV-a.
- AI varijanta B istog kviza (ista pitanja, drugačiji redoslijed/distraktori).
- PWA/offline keš za slabu školsku mrežu.
- Izvoz ocjena u format koji e-dnevnik prima.
- Analitika po odjeljenju kroz više testova (koje pitanje najčešće pada).
- Više škola (multi-tenant) i administracija na nivou škole.
