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
- Die ursprüngliche Rastervariante heißt `Wortsuchbild` und soll erhalten
  bleiben.
- Die Standardvariante `Labyrinth` ist ein echtes Maze mit SVG-Linien als
  Mauern, Eingang und Ausgang. Anders als beim `Wortsuchbild` bleiben die
  meisten Zellen leer; nur Wortbuchstaben und einstellbar viele Ablenker werden
  gesetzt.
- Beim gedruckten Labyrinth darf das Lösungswort nicht sichtbar sein; stattdessen
  werden leere Antwortkästchen gedruckt.

## Qualitätscheck

Vor einem Commit ausführen:

```sh
pnpm check
```

Bei reinen Dokumentationsänderungen reicht zusätzlich ein gezielter Blick auf
die betroffenen Markdown-Dateien; bei Code- oder Config-Änderungen ist
`pnpm check` Pflicht.
