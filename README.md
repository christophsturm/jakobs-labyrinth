# Jakob's Maze Printer

A small browser tool for creating and printing letter puzzles. Development uses
Vite and TypeScript; the production build produces a single, self-contained HTML
file.

The source files live in `src/`. `src/index.html` is the Vite entry point and is
not opened directly in the browser; the app runs through `pnpm dev` during local
development.

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

The app is then available at `http://127.0.0.1:5173/`.

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

The distributable file is:

```txt
dist/index.html
```

It can be renamed to `jakobs-labyrinth-drucker.html` and opened directly in a
browser when needed.

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
