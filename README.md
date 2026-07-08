# Buchstabenlabyrinth

Ein kleines Browser-Tool zum Erzeugen und Drucken von Buchstabenrätseln. Die
Entwicklung läuft mit Vite und TypeScript; der Produktionsbuild erzeugt eine
einzige, self-contained HTML-Datei.

Es gibt zwei Varianten:

- `Labyrinth`: ein echtes Labyrinth mit Mauern, Eingang und Ausgang. Nur an
  manchen Stellen liegen Buchstaben; der richtige Weg führt in Reihenfolge am
  Lösungswort vorbei.
- `Wortsuchbild`: die ursprüngliche Version mit Buchstabenraster und
  markierbarem Lösungspfad.

## Setup

```sh
pnpm install
```

## Entwicklung

```sh
pnpm dev
```

Die App läuft dann lokal unter `http://127.0.0.1:5173/`.

## Checks

```sh
pnpm check
```

Der Check umfasst:

- `oxfmt --check`
- `oxlint`
- `tsgo --noEmit`
- `vitest run`
- `vite build`

## Build

```sh
pnpm build
```

Die auslieferbare Datei ist:

```txt
dist/index.html
```

Diese Datei kann bei Bedarf zu `buchstabenlabyrinth.html` umbenannt und direkt
im Browser geöffnet werden.

## Bedienung

1. Variante wählen.
2. Lösungswort eingeben.
3. Größe und Schwierigkeit wählen.
4. `Neu erzeugen` klicken.
5. Optional `Lösung anzeigen`.
6. Über `Drucken` den Browser-Druckdialog öffnen.

Der Druckdialog kann auch zum Speichern als PDF verwendet werden.
