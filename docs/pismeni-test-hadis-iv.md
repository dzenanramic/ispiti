# Pismeni test iz hadisa — IV razred, I polugodište

**Status:** predlog strukture, još nije implementirano u aplikaciji.
**Izvor:** `pismeni_test_hadis_IV-v3.docx` (50 bodova, 6 zadataka, 3 grupe).

## Preporuka

Ovaj dokument nije petominutni kviz. To je pismeni test od 50 bodova sa
popunjavanjem, analizom, povezivanjem i esejom. Zato predlažem da u aplikaciji
postoje dva formata, a ne da se ovaj test sabije u pet pitanja:

| Format | Namjena | Bodovi | Trajanje | Ocjenjivanje |
|---|---|---|---|---|
| **Brzi kviz** (postojeći) | provjera na početku časa | 5 × 1 | 5 min | automatski |
| **Pismeni test** (novi) | provjera na kraju cjeline | 50 | 45 min | automatski + ručno |

Ako se ne želi širiti aplikacija, ovaj test ostaje na papiru, a u program se
unosi samo pet kratkih pitanja iz njega. To je najmanji zahvat, ali se gubi
esej, povezivanje i analiza.

## Struktura pismenog testa

### Zaglavlje

- Naziv: **Pismeni test iz hadisa — I polugodište**
- Predmet: Hadis
- Razred: **IV (maturanti)**
- Školska godina: 2026/2027.
- Trajanje: **45 minuta**
- Maksimum: **50 bodova**
- Skala (samo za nastavnikovu ocjenu, aplikacija je ne računa):
  0–25 (1), 26–32 (2), 33–39 (3), 40–45 (4), 46–50 (5).

### Grupa A — prevođenje i popunjavanje (20 bodova)

| Oznaka | Zadatak | Tip u aplikaciji | Bodovi | Ocjenjivanje |
|---|---|---|---|---|
| A1 | Nijjet — arapski tekst, 5 praznina | `cloze_multi` | 5 × 1 | automatski |
| A2 | Nijjet — bosanski prevod, 5 praznina | `cloze_multi` | 5 × 1 | automatski |
| A3 | Selam — arapski tekst, 5 praznina | `cloze_multi` | 5 × 1 | automatski |
| A4 | Selam — bosanski prevod, 5 praznina | `cloze_multi` | 5 × 1 | automatski |

Zajednička banka riječi po zadatku, sa tačnim i netačnim opcijama. Učenik
tapne riječ za svaku prazninu; aplikacija boduje svaku prazninu po 1 bod.

### Grupa B — analiza i povezivanje (18 bodova)

| Oznaka | Zadatak | Tip u aplikaciji | Bodovi | Ocjenjivanje |
|---|---|---|---|---|
| B1 | Ebu Umama: značenje „za'im”, „mira'” i tri osobine | `short_answer` | 6 (predlog 1 + 1 + 4) | ručno |
| B2 | Povezivanje 6 arapskih izraza sa prevodom | `matching` | 6 × 1 | automatski |
| B3 | 'Irbad ibn Sarija: tri ključne oporuke | `short_answer` | 6 (3 × 2) | ručno |

### Grupa C — praktična primjena (12 bodova)

| Oznaka | Zadatak | Tip u aplikaciji | Bodovi | Ocjenjivanje |
|---|---|---|---|---|
| C1 | Esej 6–8 rečenica: nijjet i čuvanje od novotarija | `essay` | 12 | ručno, po rubrikama |

Predlog rubrike za esej (12 bodova):

- razumijevanje pojma nijjeta i iskrenosti — 4 boda,
- prepoznavanje licemjerstva i novotarija kroz hadise — 4 boda,
- povezivanje sa savremenim životom, jasnoća i jezik — 4 boda.

## Bodovni bilans

| Dio | Automatski | Ručno | Ukupno |
|---|---:|---:|---:|
| Grupa A | 20 | 0 | 20 |
| Grupa B | 6 | 12 | 18 |
| Grupa C | 0 | 12 | 12 |
| **Ukupno** | **26** | **24** | **50** |

Aplikacija može odmah sabrati 26 bodova, a nastavnik dopunjava 24 boda za
kratke odgovore i esej. Završna ocjena se ne računa automatski.

## Tačni odgovori — predlog za provjeru

### A1 — Nijjet, arapski

| Praznina | Predlog | Napomena |
|---|---|---|
| 1 | `النِّيَّاتِ` | uz `بِـ` |
| 2 | `نَوَى` | |
| 3 | `يُصِيبُهَا` | |
| 4 | `يَتَزَوْجُهَا` | |
| 5 | `هَاجَرَ` | |

Distraktori: `بِالصَّدَقَةِ`, `يَكْتُبُهَا`, `يَأْكُلُهَا`.

### A2 — Nijjet, bosanski

| Praznina | Predlog |
|---|---|
| 1 | namjerama |
| 2 | zanijetio |
| 3 | ostvariti *(ili postići — potvrditi)* |
| 4 | oženiti |
| 5 | iselio |

### A3 — Selam, arapski

| Praznina | Predlog |
|---|---|
| 1 | `السَّلاَمَ` |
| 2 | `الطَّعَامَ` |
| 3 | `الأَرْحَامَ` |
| 4 | `نِيَامٌ` |
| 5 | `إِيمَانٍ` |

Distraktori: `الْكَلاَمَ`, `الأَيْتَامَ`, `سَلاَمٍ`, `الصَّلاَةَ`.

### A4 — Selam, bosanski

| Praznina | Predlog |
|---|---|
| 1 | selam |
| 2 | gladne |
| 3 | rodbinske veze |
| 4 | spavaju |
| 5 | miru *(ili dobroti — potvrditi)* |

### B2 — Povezivanje

| Arapski izraz | Prevod |
|---|---|
| 1) `إِذَا لَقِيتَهُ فَسَلِّمْ عَلَيْهِ` | B) Kada ga sretneš, nazovi mu selam. |
| 2) `وَإِذَا دَعَاكَ فَأَجِبْهُ` | D) Kada te pozove, odazovi mu se. |
| 3) `وَإِذَا اسْتَنصَحَكَ فَانْصَحْ لَهُ` | F) Kada od tebe zatraži savjet, posavjetuj ga. |
| 4) `وَإِذَا عَطَسَ فَحَمِدَ اللَّهَ فَشَمِّتْهُ` | E) Kada kihne i zahvali Allahu, dovi za njega. |
| 5) `وَإِذَا مَرِضَ فَعُدْهُ` | A) Kada se razboli, posjeti ga i obiđi. |
| 6) `وَإِذَا مَاتَ فَاتَّبِعْهُ` | C) Kada umre, isprati mu dženazu. |

### B1 i B3 — ručno

Dokument ne sadrži potpun tekst hadisa Ebu Umameta ni sve tri oporuke
'Irbada ibn Sarije. Prije unosa treba dopuniti:

- B1 c) tačno koje se tri osobine traže (npr. ostavljanje svađe i kad je
  čovjek u pravu, ostavljanje laži u šali, lijep ahlak — potvrditi),
- B3 tri oporuke (npr. bogobojaznost, slušanje i pokornost, držanje Sunneta —
  potvrditi).

## Šta aplikacija treba da dobije

1. **Novi tip kviza:** `quick` (postojeći) i `exam` (pismeni).
2. **Nove tipove pitanja:**
   - `cloze_multi` — tekst sa više praznina i zajedničkom bankom riječi,
   - `matching` — parovi lijevo/desno,
   - `short_answer` — kratak odgovor, ručno bodovanje,
   - `essay` — duži tekst, ručno bodovanje po rubrici.
3. **Bodovi po pitanju i po praznini**, ne samo 1 po pitanju.
4. **Sekcije A/B/C** sa naslovom, uputom i zbirom bodova.
5. **Tajmer do 45 minuta** (trenutno je maksimum 15).
6. **Ekran za ocjenjivanje:** nastavnik vidi odgovore, upisuje bodove po
   pitanju, aplikacija sabira automatski + ručno.
7. **Rezultati i CSV** sa bodovima po sekcijama, ne samo ukupnim skorom.
8. **Skala ocjena** je informativna; nastavnik i dalje daje konačnu ocjenu.

## Ako ostajemo na brzom kvizu

Za pet minuta iz ovog testa može se izdvojiti pet pitanja, na primjer:

1. `إِنَّمَا الْأَعْمَالُ بِـ___` — jedan odgovor (`النِّيَّاتِ`).
2. „Djela se vrednuju prema ___" — dopuna (`namjerama`).
3. `أَفْشُوا ___` — jedan odgovor (`السَّلاَمَ`).
4. „Kada ga sretneš, ___" — jedan odgovor (nazovi mu selam).
5. Tačno/netačno: „Djelo se vrednuje prema namjeri." — tačno.

To je 5 bodova i 5 minuta, ali nije isti test — ne provjerava analizu, povezivanje
ni esej.

## Prije implementacije potvrditi

- [ ] Da li želiš puni pismeni test (50 bodova, 45 min) ili samo brzi kviz?
- [ ] Tačni odgovori za A2/3 i A4/5 (ostvariti/postignuti; miru/dobroti).
- [ ] Puni tekst i odgovor za B1 c) i B3.
- [ ] Rubrika za esej (predlog 4 + 4 + 4).
- [ ] Da li se pismeni radi na telefonu ili ostaje na papiru, a aplikacija služi
      samo za unos bodova?
