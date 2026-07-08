# AGENTS.md

## Projektkontext

Dies ist eine kleine Vite/TypeScript-App ohne Framework. Das ausgelieferte
Produkt soll eine einzelne HTML-Datei bleiben: `dist/index.html`.

## Arbeitsweise

- Paketmanager: `pnpm`.
- Vor Änderungen vorhandene Muster in `index.html`, `main.ts` und
  `vite.config.ts` übernehmen.
- `dist/` nicht manuell editieren. Änderungen gehören in die Quellen und werden
  mit `pnpm build` erzeugt.
- Keine Deno- oder PDF-Generator-Abhängigkeiten hinzufügen. Drucken und
  PDF-Speichern laufen über den Browser-Druckdialog.
- Puzzle-Ausgabe bleibt SVG, damit Druck und Skalierung sauber bleiben.

## Qualitätscheck

Vor einem Commit ausführen:

```sh
pnpm check
```

Bei reinen Dokumentationsänderungen reicht zusätzlich ein gezielter Blick auf
die betroffenen Markdown-Dateien; bei Code- oder Config-Änderungen ist
`pnpm check` Pflicht.
