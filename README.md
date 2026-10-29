# Jakob's Maze Printer

A small browser tool for creating and printing letter puzzles, plus a separate
dice roller and a Pokémon label printer. Development uses Vite and TypeScript;
the production build produces three self-contained HTML pages.

The source files live in `src/`. `src/index.html` is the printer entry point and
`src/dice/index.html` is the dice tool entry point, and `src/pokemon/index.html`
is the label printer entry point. They are not opened directly
in the browser; the apps run through `pnpm dev` during local development.

The app provides two puzzle types:

- `Maze`: a real maze with walls, an entrance, and an exit. Letters appear only
  in selected cells, and the correct path passes the solution word in order. The
  amount of additional letters can be configured separately.
- `Word search`: the original version with a letter grid and a solution path
  that can be highlighted.

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm dev
```

The printer is then available at `http://127.0.0.1:5173/`, and the dice tool at
`http://127.0.0.1:5173/dice/`. The Pokémon label printer is available at
`http://127.0.0.1:5173/pokemon/` and linked from the maze printer.

## Checks

```sh
pnpm check
```

This command runs:

- `oxfmt --check`
- `oxlint`
- `tsgo --noEmit`
- `vitest run`
- `vite build`

## Build

```sh
pnpm build
```

The distributable pages are:

```txt
dist/index.html
dist/dice/index.html
dist/pokemon/index.html
```

Each page contains its own scripts and styles without external build assets.
The Pokémon page also embeds all 151 Pokémon images and 44 card images and can
be used offline.

## Usage

1. Select a puzzle type.
2. Enter the solution word.
3. Choose the size and difficulty.
4. For mazes, optionally select the amount of additional letters.
5. Select `Add puzzle`. The first puzzle replaces the initial demo; subsequent
   puzzles are appended to the list.
6. Remove individual puzzles using the red × on their card.
7. Optionally select `Show solution`.
8. Select `Print` to open the browser's print dialog.

The solution word is omitted from a printed maze's heading. Empty boxes are
printed instead so the found word can be filled in. The printout also includes
the app's base URL. The browser's print dialog can be used to save the puzzles as
a PDF.

## Dice tool

The dice tool is intentionally separate from the printer and offers four sets:

- `Color & shape`: independently rolls one of four colors and one of four
  geometric shapes.
- `Kniffel`: rolls five six-sided dice.
- `Two dice`: rolls two six-sided dice.
- `Custom set`: rolls between one and twelve W4, W6, W8, W10, W12, or W20 dice.

Tap the playing area or press Space to roll again. The selected set is preserved
in the URL so a specific setup can be bookmarked.

## Pokémon label printer

The first stock format is an A4 Zweckform sheet with 3 columns and 8 rows:
24 labels measuring exactly 70 × 37.125 mm, without margins or gaps. There is no
assumed product number. Further stock formats can be added to `labelFormats` in
`src/pokemon/layout.ts`; the app also accepts custom A4 dimensions, margins and
gutters and checks that the grid fits on the page.

- Search the first 151 Pokémon by German or English name or Pokédex number.
- Click a picture to place it in the selected label. The selection moves to the
  next empty label. Click an occupied label to delete its picture; click an empty
  label to select it. Drag a picture to move it into an empty slot or swap it
  with another picture. Dropping outside the sheet or pressing Escape cancels
  the move. Arrow keys navigate; Shift + arrow keys move/swap; Enter, Space and
  Delete clear a selected picture. Changes can be undone.
- The `Sammelkarten` tab contains 44 German illustration, ex and gold cards from
  the community database [TCGdex](https://tcgdex.dev/de), from the sets `151` and
  `Prismatische Entwicklungen`. Cards rotate 90° on landscape labels and retain
  their full image and proportions. The printed image cannot reproduce foil shine.
- Fill the remaining empty labels with the last selected picture, clear individual
  labels or the entire sheet, and undo edits. Empty positions are preserved for
  partially used sheets.
- Add multiple sheets. Entirely empty sheets are skipped during printing.
- Optionally print names, reduce picture size or adjust the print offset in mm.
- Upload PNG, JPEG or WebP images (up to 12 MB each). Uploads stay local; the
  current layout and uploads last only for the current browser session.
- Use the browser print dialog to print or save as PDF. Select **A4, portrait,
  100% / actual size, single-sided, and no headers or footers**. Preview guides,
  selection borders and label numbers are omitted from printouts. First test
  alignment on plain paper; the printer's unprintable margins still apply.

Printing uses a separate, direct child of the document body, populated for both
the print button and the browser's Print command. It contains only nonempty
sheets. A 3 mm page margin and a compensating SVG offset preserve the original
210 × 297 mm coordinates. The flow box leaves 0.5 mm of rounding tolerance at
the bottom; the SVG itself is never scaled. Page breaks occur before subsequent
sheets, avoiding a trailing blank page. This avoids relying on the editor's
responsive layout when Safari paginates the document.

The artwork comes from the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites)
(`sprites/pokemon/other/official-artwork/1.png` through `151.png`). The images are
stored locally as WebP at their original resolution, encoded at quality 92.
German and English names come from the
[PokeAPI species names](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv).
Pokémon artwork and names belong to Nintendo / Creatures / GAME FREAK. The app
does not make API requests at runtime or download images during the build.
Card images are embedded from TCGdex's German high-resolution WebP assets.
`src/pokemon/cards.json` records the set, card number, API URL and image source
for each bundled card. TCGdex is a community project, not an official Pokémon API.
