# Ispiti

Kratki test za prvih pet minuta časa. Nastavnik pripremi kviz, učenici ga riješe na telefonu preko QR koda, a rezultati su odmah u tabeli — bez štampanja i bez čekanja do sljedećeg časa.

Aplikacija je napravljena za jednu školu i više nastavnika. Pilot predmet je hadis, ali model je generički: bosanski, historija, geografija, arapski i svi ostali predmeti rade isto.

---

## Kako radi

**Nastavnik**

1. Napravi kviz — ručno kroz formu ili zalijepi pitanja iz teksta po šablonu; odmah izabere razred kojem kviz pripada.
2. Sačuva kviz i otvori test u tom razredu (ili to uradi kasnije iz liste kvizova). Dobije kod od 6 znakova i QR kod.
3. Pritisne „Počni test" kada su učenici spremni. Tajmer kreće za sve u istom trenutku.
4. Gleda uživo ko je ušao, ko je predao i koliko bodova ima. Po potrebi oslobađa telefon koji je vezan za pogrešno ime. Na kraju vidi matricu odgovora po pitanju.

**Učenik**

1. Skenira QR ili otvori link, izabere svoje ime sa spiska. Prvi izbor veže telefon za to ime u odjeljenju.
2. Čeka da nastavnik pokrene test.
3. Odgovara na 5 pitanja, odgovori se čuvaju automatski, predaje test. Vidi samo „predano" — bez tačnih odgovora. Ako napusti stranicu tokom testa, test se predaje kada se vrati.

**Ocjena**

Bodovi iz svih testova se sabiraju u pregledu uspjeha odjeljenja. Ocjenu i dalje daje nastavnik — aplikacija je ne upisuje, ne predlaže završnu ocjenu i nije povezana sa e-dnevnikom.

---

## Funkcije (MVP)

- Prijava nastavnika emailom i lozinkom; uloga nastavnik i administrator.
- Odjeljenja sa spiskom učenika (unos lijepljenjem, deaktivacija bez brisanja historije).
- Kvizovi: 1–20 pitanja; tipovi:
  - tačno / netačno (1 bod),
  - jedan tačan odgovor (1 bod),
  - dopuna iz ponuđenih riječi (word bank — učenik tapne riječ, ne kuca; 1 bod).
  - hadis / tekst sa više praznina (word bank za sve praznine — učenik tapne
    prazninu, pa riječ; arapski tekst se čita zdesna nalijevo, a oznake
    `(1)`, `(2)`… ostaju uz svoju prazninu; 1 bod).
  - povezivanje parova (učenik tapne stavku lijevo, pa njenu stavku desno;
    desna kolona je izmiješana; **1 bod po tačno spojenom paru**, pa pitanje sa
    6 parova nosi 6 bodova).
- Uvoz pitanja iz teksta po šablonu (vidi ispod).
- AI uvoz: nastavnik ubaci `.docx`, `.txt` ili zalijepi tekst, a AI predloži 5 pitanja (do 10 ako ih dokument ima više) i tačne odgovore. Predlog se uvijek otvara u editoru — nastavnik ga pregleda i tek onda čuva.
- Kviz pripada jednom razredu; pokreće se samo u njemu. Za drugo odjeljenje duplikuj kviz i izmijeni pitanja.
- „Sačuvaj i otvori test" odmah pravi lobby sesiju; ako razred već ima otvoren test, nudi se nastavak umjesto drugog koda.
- Sesija: QR + 6-znakovni kod, lobby, sinhronizovani tajmer (3/5/6/10 min), zaključavanje ulaza, produženje vremena, poništavanje pokušaja, ručni upis rezultata za odsutne.
- Napuštanje testa: kad učenik sakrije stranicu (home, app switcher, zaključan ekran), to se beleži; test se automatski predaje kada se vrati. Kratak prekid ne predaje odmah. Nastavnik u konzoli vidi oznake „napustio" i „predao (izašao)".
- Učenik bez naloga: ime se trajno veže za uređaj u odjeljenju (ne samo za jednu sesiju), jedan pokušaj po učeniku. Nastavnik može osloboditi uređaj iz konzole testa.
- Lokalno čuvanje odgovora: svaki odgovor se upisuje u `localStorage` prije slanja; poslije reloada se vraća i ponovo šalje. Predaja čeka da svi odgovori stignu na server.
- Rezultati uživo, matrica učenik × pitanje, uspješnost po pitanju, štampa i CSV izvoz.
- Arapski tekst i RTL prikaz u pitanjima i ponuđenim odgovorima; kod hadisa sa
  prazninama praznine ostaju na svom mjestu u rečenici i kad se tekst čita
  zdesna nalijevo.
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

4. Dopuni hadis o nijjetu.
„Zaista se djela vrednuju prema _____ (1), i zaista svakom čovjeku pripada ono
što je _____ (2), a čija hidžra bude radi materijalne dobiti koju želi
_____ (3).“
Riječi: zanijetio, namjerama, iselio, ostvariti, dobiti
Praznine: namjerama; zanijetio; ostvariti
```

- `Tačno:` prima `T`/`N`, `Tačno`/`Netačno`, `Da`/`Ne`, ili slovo/number opcije.
- Ako nema opcija i nema riječi, pitanje je tačno/netačno.
- Kod dopune, `Riječi:` je obavezan; ako u tekstu nema `_____`, dodaje se na kraj.
- Kod teksta sa više praznina: stavi `_____ (1)`, `_____ (2)`… u tekst, `Riječi:`
  je zajednička banka (tačne i netačne riječi), a `Praznine: riječ1; riječ2; …`
  daje tačnu riječ za svaku prazninu redom. Ako broj praznina i odgovora ne
  odgovara, uvoz prijavi grešku umjesto da nešto pogodi.
- Kod povezivanja: prvi red je uputa (tekst pitanja), a svaki par ide u svoj
  red kao `1) arapski izraz = prijevod` (najviše osam parova). Prvi red ne
  smije početi brojem i zagradom, inače bi ga uvoz čitao kao par.

```text
5. Poveži arapski izraz s prijevodom.
1) إِذَا لَقِيتَهُ فَسَلِّمْ عَلَيْهِ = Kada ga sretneš, nazovi mu selam.
2) وَإِذَا دَعَاكَ فَأَجِبْهُ = Kada te pozove, odazovi mu se.
3) وَإِذَا مَاتَ فَاتَّبِعْهُ = Kada umre, isprati mu dženazu.
```

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

### AI uvoz

U `.env.local` (i u Vercelu) postavi:

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

Ako ključ nije postavljen, AI dugme prikaže poruku, a ručni unos i šablonski uvoz rade normalno. Dokument se šalje AI provajderu samo radi pravljenja predloga; ne čuva se na serveru.

Na Vercelu: **Project → Settings → Environment Variables** dodaj
`DEEPSEEK_API_KEY` (Production) i redeploy. Bez toga će AI uvoz na produkciji
prikazati „AI uvoz nije podešen“, a sve ostalo radi.

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
- `student_devices` — trajna veza učenika i uređaja u odjeljenju; jedan uređaj po učeniku i jedno ime po uređaju. Nastavnik je može osloboditi iz konzole testa.
- `quizzes` / `questions` — sadržaj kviza i razred kojem pripada; pitanja se ne mijenjaju ako je kviz korišten (historija ostaje tačna).
- `sessions` — izvođenje kviza u odjeljenju; kod, status, tajmer, zaključan ulaz.
- `attempts` — jedan pokušaj učenika u sesiji; token uređaja, token pokušaja, bodovi, razlog predaje (`student`/`time`/`left`/`closed`) i broj napuštanja stranice sa zadnjim vremenom.
- `answers` — odgovor po pitanju, odmah ocijenjen.
- `grades` — ocjene nastavnika, više po polugodištu.

Kviz pripada jednom razredu, a sesija je jedno izvođenje tog kviza. Ako isti sadržaj treba i drugom razredu, kviz se duplikuje — time se pitanja mogu prilagoditi razredu, a historija ostaje jasna.

---

## Sigurnost i ograničenja

- **Identitet učenika nije verifikovan.** Pri prvom ulasku učenik sam izabere ime; aplikacija taj izbor trajno veže za uređaj (HttpOnly kolačić + `localStorage` + jedinstveni indeks u bazi) za cijelo odjeljenje, ne samo za jednu sesiju. U sljedećem testu učenik ne može izabrati drugo ime, a ni ime drugog učenika ne može preuzeti na svom telefonu. Ako učenik promijeni telefon ili obriše sve podatke preglednika, nastavnik oslobodi uređaj u konzoli testa. Prvi ulazak se ne može kriptografski dokazati — ako je ime ukradeno prije nego što ga je pravi učenik preuzeo, nastavnik poništi pokušaj i oslobodi uređaj. **IP adresa se ne koristi kao ključ identiteta**: u školi su uređaji često iza istog NAT-a, a DHCP/VPN je mijenja; čuva se samo kao podatak za nastavnikovu provjeru.
- **Napuštanje testa se detektuje, ne sprečava.** Preglednik ne može blokirati home dugme ni app switcher. Aplikacija sluša `visibilitychange` i `pagehide`, beleži napuštanje (vrijeme i broj) i predaje test kada se učenik vrati — i poslije reloada ili ponovnog otvaranja taba. Kratak poziv ili poruka takođe može predati test; zato je upozorenje prikazano prije i tokom testa. Split-screen, drugi telefon ili VPN ostaju zaobići; za pravu zaključanost potreban je kiosk režim (Android screen pinning/MDM, iOS Guided Access) ili native aplikacija.
- **Kasni ulazak** je dozvoljen dok nastavnik ne zaključa ulaz ili ne istekne vrijeme. Učenik dobija preostalo vrijeme.
- **Jedan pokušaj** po učeniku po sesiji. Nastavnik može poništiti pokušaj, osloboditi uređaj i ručno upisati bodove.
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
