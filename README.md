# Podsieci - trener IPv4

PWA do nauki dzielenia na podsieci bez rozpisywania bitów (metoda magicznej liczby), VLSM i zagadnień L2/L3 z labów *Bezpieczeństwo Lokalnych Sieci Komputerowych* (AGH).

Działa w pełni offline i instaluje się na iPadzie, telefonie i komputerze jak zwykła aplikacja. Opcjonalny backend na Supabase dodaje konta (GitHub, Google), synchronizację postępu i pojedynki 1 na 1 na żywo.

## Co jest w środku

- Kalkulator z linijką 32 bitów, mapą bloków i krokami metody
- Trening: losowe podsieci w trzech poziomach, stoper, podpowiedzi
- Szybkie pytania i Sprint 60 s
- Generator zadań VLSM (z /24 i /22), akceptuje każdy poprawny układ
- Rozwiązane zadania z labów 1–3 i quiz L2/L3
- XP, rangi i statystyki zapisywane lokalnie, a po zalogowaniu synchronizowane między urządzeniami
- Pojedynki 1 na 1: ten sam zestaw 10 pytań, wynik na żywo, odpowiedzi oceniane na serwerze

## Uruchomienie lokalnie

```bash
npm install
npm run dev       # serwer deweloperski
npm test          # testy logiki IP, VLSM i bazy danych (Vitest + PGlite)
npm run build     # produkcyjny build do dist/
npm run preview   # podgląd buildu, z działającym service workerem
```

### Model bezpieczeństwa

- Wszystkie tabele mają włączone RLS, a klient ma wyłącznie prawo odczytu. Każda zmiana idzie przez funkcje RPC (`security definer`) z własną walidacją.
- XP nie da się ustawić bezpośrednio. `sync_progress` przyjmuje jednorazowy import lokalnego postępu, potem przyrost jest ograniczony do 6 XP na sekundę.
- Klucz odpowiedzi pojedynku leży w tabeli bez żadnej polityki odczytu. Pytania są widoczne dopiero po starcie odliczania, odpowiedzi sprawdza serwer, a kolejność pytań jest wymuszona.
- Wpisane odpowiedzi przeciwnika są niewidoczne, nawet przez Realtime: trzymane osobno, ujawniane tylko w podsumowaniu po zakończeniu.
- Nazwy z profili OAuth są escapowane przed wstawieniem do HTML.
- `supabase/tests/db.test.ts` sprawdza te reguły na prawdziwym Postgresie (PGlite) w CI.

## Instalacja na mobilkach
Otwórz stronę w Safari → Udostępnij → **Do ekranu początkowego**. Po pierwszym wczytaniu (w stopce pojawi się „Gotowe offline”) działa bez internetu. Nowe wersje pobierają się same przy kolejnym uruchomieniu z siecią.

## Stack

Vite, TypeScript (bez frameworka), vite-plugin-pwa (Workbox), Supabase (Postgres, Auth, Realtime), Vitest + PGlite, fonty Chakra Petch i JetBrains Mono hostowane lokalnie przez Fontsource.

```
src/
  lib/      ip.ts, vlsm.ts (czysta logika + testy), progress.ts, store.ts, dom.ts, supabase.ts, sync.ts
  ui/       hero, walkthrough, trening, flash, vlsm, quiz, explain, account, duel
  data/     quiz.ts
public/icons/
supabase/
  migrations/   schemat, RLS i funkcje RPC
  tests/        testy bazy na PGlite
```
