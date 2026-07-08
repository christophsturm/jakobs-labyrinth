# Buchstabenlabyrinth

Ein kleines Browser-Tool zum Erzeugen und Drucken von Buchstabenlabyrinthen.
Die Entwicklung läuft mit Vite und TypeScript; der Produktionsbuild erzeugt
eine einzelne, self-contained HTML-Datei.

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

1. Lösungswort eingeben.
2. Größe und Schwierigkeit wählen.
3. `Neu erzeugen` klicken.
4. Optional `Lösung anzeigen`.
5. Über `Drucken` den Browser-Druckdialog öffnen.

Der Druckdialog kann auch zum Speichern als PDF verwendet werden.
