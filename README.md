# Podsieci - trener IPv4

PWA do nauki dzielenia na podsieci bez rozpisywania bitów , VLSM i zagadnień L2/L3 z labów *Bezpieczeństwo Lokalnych Sieci Komputerowych* 

Działa w pełni offline i instaluje się na iPadzie, telefonie i komputerze jak zwykła aplikacja.

## Co jest w środku

- Kalkulator z linijką 32 bitów, mapą bloków i krokami metody
- Trening: losowe podsieci w trzech poziomach, stoper, podpowiedzi
- Szybkie pytania i Sprint 60 s
- Generator zadań VLSM, akceptuje każdy poprawny układ
- Rozwiązane zadania z labów 1-3 i quiz L2/L3
- XP, rangi i statystyki zapisywane lokalnie 

## Uruchomienie lokalnie

```bash
npm install
npm run dev       # serwer deweloperski
npm test          # testy logiki IP i VLSM 
npm run build     # produkcyjny build do dist/
npm run preview   # podgląd buildu, z działającym service workerem
```

## Instalacja na urządzeniu mobilnym

Otwórz stronę w Safari → Udostępnij → **Do ekranu początkowego**. Po pierwszym wczytaniu działa bez internetu. Nowe wersje pobierają się same przy kolejnym uruchomieniu z siecią.

## Stack

Vite, TypeScript, vite-plugin-pwa, Vitest, fonty Chakra Petch i JetBrains Mono hostowane lokalnie przez Fontsource.

```
src/
  lib/      ip.ts, vlsm.ts, progress.ts, store.ts, dom.ts
  ui/       hero, trening, flash, vlsm, quiz, explain
  data/     quiz.ts
public/icons/
```
