import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  generateMazePuzzle,
  generatePuzzle,
  generateWordSearchPuzzle,
  languageFromLocales,
  makeSeed,
  normalizeWord,
  normalizeWordWithFeedback,
  pathSpellsWord,
  pointKey,
  renderAnswerBoxesHtml,
  renderSvg,
  type MazePuzzle,
  type Point,
  type PuzzleLanguage,
  type WordSearchPuzzle,
} from "./main";

describe("normalizeWord", () => {
  test("keeps German uppercase letters and removes separators", () => {
    expect(normalizeWord("  Eis-Bär 42! ")).toBe("EISBÄR");
    expect(normalizeWord("straße")).toBe("STRASSE");
  });

  test("folds accents for English, Italian, and French words", () => {
    expect(normalizeWord("jalapeño", "en")).toBe("JALAPENO");
    expect(normalizeWord("perché", "it")).toBe("PERCHE");
    expect(normalizeWord("cœur d'été", "fr")).toBe("COEURDETE");
  });

  test("reports unsupported characters instead of silently changing the input", () => {
    expect(normalizeWordWithFeedback("CAFÉ")).toEqual({
      word: "CAF",
      changed: true,
      removedCharacters: true,
      hadInput: true,
    });
    expect(normalizeWordWithFeedback("1234")).toEqual({
      word: "",
      changed: true,
      removedCharacters: true,
      hadInput: true,
    });
    expect(normalizeWordWithFeedback("CAFÉ", "fr")).toEqual({
      word: "CAFE",
      changed: true,
      removedCharacters: false,
      hadInput: true,
    });
  });
});

describe("languageFromLocales", () => {
  test.each([
    [["en-US"], "en"],
    [["it-IT", "en-US"], "it"],
    [["pt-BR", "fr-CA"], "fr"],
    [["de-AT"], "de"],
    [["es-ES"], "de"],
    [[], "de"],
  ] satisfies Array<[string[], PuzzleLanguage]>)("maps %j to %s", (locales, expected) => {
    expect(languageFromLocales(locales)).toBe(expected);
  });
});

describe("makeSeed", () => {
  test("creates deterministic non-zero seeds", () => {
    expect(makeSeed("abc")).toBe(makeSeed("abc"));
    expect(makeSeed("abc")).not.toBe(0);
    expect(makeSeed("abc")).not.toBe(makeSeed("abd"));
  });
});

describe("generateWordSearchPuzzle", () => {
  test("keeps the previous word-search image as a non-repeating orthogonal path", () => {
    const puzzle = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 1234,
    });

    expect(puzzle.kind).toBe("wordSearch");
    expect(puzzle.word).toBe("DRACHE");
    expect(puzzle.solutionPath).toHaveLength(6);
    expect(new Set(puzzle.solutionPath.map(pointKey))).toHaveLength(6);
    expect(pathSpellsWord(puzzle)).toBe("DRACHE");
    expectOrthogonalPath(puzzle.solutionPath);
  });

  test("is deterministic when a seed is provided", () => {
    const first = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });
    const second = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });

    expect(second.solutionPath).toEqual(first.solutionPath);
    expect(second.letters).toEqual(first.letters);
  });
});

describe("generateMazePuzzle", () => {
  test("creates a real maze where the solution path passes the word letters", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });

    expect(puzzle.kind).toBe("maze");
    expect(puzzle.word).toBe("DRACHE");
    expect(puzzle.solutionPath.length).toBeGreaterThanOrEqual(puzzle.word.length);
    expect(new Set(puzzle.solutionPath.map(pointKey))).toHaveLength(puzzle.solutionPath.length);
    expect(puzzle.start).toEqual(puzzle.solutionPath[0]);
    expect(puzzle.end).toEqual(puzzle.solutionPath[puzzle.solutionPath.length - 1]);
    expect(pathSpellsWord(puzzle)).toBe("DRACHE");
    expectOrthogonalPath(puzzle.solutionPath);
    expectMazePathOpen(puzzle);
    expectBoundaryOpening(puzzle, puzzle.entrance);
    expectBoundaryOpening(puzzle, puzzle.exit);
    expect(countLetters(puzzle.letters)).toBeGreaterThan(puzzle.word.length);
    expect(countLetters(puzzle.letters)).toBeLessThan(puzzle.cols * puzzle.rows);
    expect(countOccupiedColumns(puzzle.letters)).toBeGreaterThanOrEqual(5);
    expect(countOccupiedRows(puzzle.letters)).toBeGreaterThanOrEqual(5);
  });

  test("supports a maze-only letter amount setting", () => {
    const base = {
      kind: "maze" as const,
      word: "TOR",
      cols: 8,
      difficulty: "medium" as const,
      seed: 99,
    };
    const few = generateMazePuzzle({ ...base, mazeLetterAmount: "few" });
    const normal = generateMazePuzzle({ ...base, mazeLetterAmount: "normal" });
    const many = generateMazePuzzle({ ...base, mazeLetterAmount: "many" });

    expect(countLetters(few.letters)).toBeLessThan(countLetters(normal.letters));
    expect(countLetters(normal.letters)).toBeLessThan(countLetters(many.letters));
    expect(pathSpellsWord(many)).toBe("TOR");
  });

  test("stores the selected language and uses its normalized letters", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      language: "fr",
      word: "été",
      cols: 6,
      difficulty: "easy",
      seed: 2026,
    });

    expect(puzzle.language).toBe("fr");
    expect(pathSpellsWord(puzzle)).toBe("ETE");
    expect(puzzle.letters.flat().every((letter) => /^[A-Z]*$/.test(letter))).toBe(true);
  });

  test("supports non-square grids through the public API", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "KOMET",
      cols: 8,
      rows: 6,
      difficulty: "hard",
      seed: 20260708,
    });

    expect(puzzle.cols).toBe(8);
    expect(puzzle.rows).toBe(6);
    expect(pathSpellsWord(puzzle)).toBe("KOMET");
    expectOrthogonalPath(puzzle.solutionPath);
    expectMazePathOpen(puzzle);
    expectBoundaryOpening(puzzle, puzzle.entrance);
    expectBoundaryOpening(puzzle, puzzle.exit);
  });

  test("falls back to a full snake maze when the word fills a small grid", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "ABCDEFGHIJKLMNOPQRSTUVWXY",
      cols: 5,
      rows: 5,
      difficulty: "easy",
      seed: 1,
    });

    expect(puzzle.solutionPath).toHaveLength(25);
    expect(new Set(puzzle.solutionPath.map(pointKey))).toHaveLength(25);
    expect(pathSpellsWord(puzzle)).toBe("ABCDEFGHIJKLMNOPQRSTUVWXY");
    expectOrthogonalPath(puzzle.solutionPath);
    expectMazePathOpen(puzzle);
    expectBoundaryOpening(puzzle, puzzle.entrance);
    expectBoundaryOpening(puzzle, puzzle.exit);
  });

  test("defaults generatePuzzle to the real labyrinth variant", () => {
    const puzzle = generatePuzzle({
      word: "TOR",
      cols: 6,
      difficulty: "easy",
      seed: 7,
    });

    expect(puzzle.kind).toBe("maze");
  });
});

describe("validation", () => {
  test("rejects words that cannot fit into the grid", () => {
    expect(() =>
      generatePuzzle({
        word: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        cols: 4,
        rows: 4,
        difficulty: "easy",
      }),
    ).toThrow("zu lang");
  });

  test("rejects unsupported select values at runtime", () => {
    expect(() =>
      generatePuzzle({
        kind: "circle" as never,
        word: "TOR",
        cols: 6,
        difficulty: "easy",
      }),
    ).toThrow("Variante");

    expect(() =>
      generatePuzzle({
        word: "TOR",
        cols: 6,
        difficulty: "brutal" as never,
      }),
    ).toThrow("Schwierigkeit");
  });

  test("gives a specific message when input contains no supported letters", () => {
    expect(() =>
      generatePuzzle({
        word: "1234",
        cols: 6,
        difficulty: "easy",
      }),
    ).toThrow("Buchstaben A-Z, Ä, Ö oder Ü");
  });
});

describe("renderSvg", () => {
  test("escapes dynamic text and hides the word-search solution line by default", () => {
    const puzzle: WordSearchPuzzle = {
      kind: "wordSearch",
      language: "de",
      word: "<BAD>",
      cols: 2,
      rows: 2,
      difficulty: "easy",
      seed: 1,
      letters: [
        ["<", "A"],
        ["&", ">"],
      ],
      solutionPath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      wordLetterPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };

    const svg = renderSvg(puzzle, { showSolution: false });

    expect(svg).toContain("&lt;BAD&gt;");
    expect(svg).toContain("&amp;");
    expect(renderSvg({ ...puzzle, word: "A'B" }, { showSolution: false })).toContain("A&#39;B");
    expect(svg).not.toContain("<polyline");
  });

  test("draws sparse maze letters, wall openings, and hides the solution line by default", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "TOR",
      cols: 6,
      difficulty: "easy",
      mazeLetterAmount: "few",
      seed: 14,
    });

    const hidden = renderSvg(puzzle, { showSolution: false });
    const visible = renderSvg(puzzle, { showSolution: true });

    expect(hidden).toContain("<line");
    expect(hidden).toContain("Eingang");
    expect(hidden).toContain("Ausgang");
    expect(hidden).not.toContain("TOR</title>");
    expect(hidden).not.toContain("für TOR");
    expect(hidden).not.toContain("<polyline");
    expect(visible).toContain("<polyline");
    expect(countLetters(puzzle.letters)).toBeLessThanOrEqual(3);
  });

  test("uses localized labels in generated SVG", () => {
    const french = generateMazePuzzle({
      kind: "maze",
      language: "fr",
      word: "été",
      cols: 6,
      difficulty: "easy",
      seed: 14,
    });
    const italian = generateWordSearchPuzzle({
      kind: "wordSearch",
      language: "it",
      word: "perché",
      cols: 8,
      difficulty: "easy",
      seed: 15,
    });

    expect(renderSvg(french, { showSolution: false })).toContain("Labyrinthe de lettres");
    expect(renderSvg(french, { showSolution: false })).toContain("Entrée");
    expect(renderSvg(french, { showSolution: false })).toContain("Sortie");
    expect(renderSvg(italian, { showSolution: true })).toContain("Cerca parole");
    expect(renderSvg(italian, { showSolution: true })).toContain("Inizio");
  });

  test("marks maze solution-only SVG elements so print CSS can hide them", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "TOR",
      cols: 6,
      difficulty: "easy",
      seed: 14,
    });

    const visible = renderSvg(puzzle, { showSolution: true });

    expect(visible).toContain('class="solution-layer print-hidden-solution"');
    expect(visible).toContain('class="solution-highlight print-hidden-solution"');
  });
});

describe("renderAnswerBoxesHtml", () => {
  test("renders one printable answer box per maze word letter only", () => {
    const maze = generateMazePuzzle({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });
    const wordSearch = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });

    expect(renderAnswerBoxesHtml(maze).match(/class="answer-box"/g)).toHaveLength(6);
    expect(renderAnswerBoxesHtml(wordSearch)).toBe("");
  });

  test("localizes the printable answer-box label", () => {
    const maze = generateMazePuzzle({
      kind: "maze",
      language: "en",
      word: "DRAGON",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });

    expect(renderAnswerBoxesHtml(maze)).toContain("Solution word");
  });
});

describe("project configuration", () => {
  test("formatter scripts scan the project instead of enumerating today's files", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.fmt).toBe("oxfmt .");
    expect(packageJson.scripts["fmt:check"]).toBe("oxfmt --check .");
  });

  test("print CSS hides SVG solution layers", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain(".print-hidden-solution");
    expect(html).toMatch(/@media print[\s\S]*\.print-hidden-solution[\s\S]*display:\s*none/);
  });

  test("includes a language selector with the supported languages", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('select id="language"');
    expect(html).toContain('value="en"');
    expect(html).toContain('value="it"');
    expect(html).toContain('value="fr"');
  });

  test("keeps sidebar controls shrinkable after long localized labels", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toMatch(/label\s*\{[\s\S]*min-width:\s*0/);
    expect(html).toMatch(/input,\s*select\s*\{[\s\S]*min-width:\s*0/);
  });
});

function expectOrthogonalPath(path: Point[]): void {
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];

    expect(current).toBeDefined();
    expect(next).toBeDefined();

    if (!current || !next) {
      throw new Error("Missing path point.");
    }

    expect(Math.abs(next.x - current.x) + Math.abs(next.y - current.y)).toBe(1);
  }
}

function expectMazePathOpen(puzzle: MazePuzzle): void {
  for (let index = 0; index < puzzle.solutionPath.length - 1; index += 1) {
    const current = puzzle.solutionPath[index];
    const next = puzzle.solutionPath[index + 1];

    if (!current || !next) {
      throw new Error("Missing maze path point.");
    }

    const currentCell = puzzle.maze[current.y]?.[current.x];
    const nextCell = puzzle.maze[next.y]?.[next.x];

    expect(currentCell).toBeDefined();
    expect(nextCell).toBeDefined();

    if (!currentCell || !nextCell) {
      throw new Error("Missing maze cell.");
    }

    if (next.x === current.x + 1) {
      expect(currentCell.walls.right).toBe(false);
      expect(nextCell.walls.left).toBe(false);
    } else if (next.x === current.x - 1) {
      expect(currentCell.walls.left).toBe(false);
      expect(nextCell.walls.right).toBe(false);
    } else if (next.y === current.y + 1) {
      expect(currentCell.walls.bottom).toBe(false);
      expect(nextCell.walls.top).toBe(false);
    } else if (next.y === current.y - 1) {
      expect(currentCell.walls.top).toBe(false);
      expect(nextCell.walls.bottom).toBe(false);
    } else {
      throw new Error("Maze path contains non-adjacent cells.");
    }
  }
}

function expectBoundaryOpening(puzzle: MazePuzzle, opening: MazePuzzle["entrance"]): void {
  const cell = puzzle.maze[opening.point.y]?.[opening.point.x];

  expect(cell).toBeDefined();

  if (!cell) {
    throw new Error("Missing opening cell.");
  }

  expect(cell.walls[opening.side]).toBe(false);

  if (opening.side === "left") {
    expect(opening.point.x).toBe(0);
  } else if (opening.side === "right") {
    expect(opening.point.x).toBe(puzzle.cols - 1);
  } else if (opening.side === "top") {
    expect(opening.point.y).toBe(0);
  } else {
    expect(opening.point.y).toBe(puzzle.rows - 1);
  }
}

function countLetters(letters: string[][]): number {
  return letters.flat().filter(Boolean).length;
}

function countOccupiedColumns(letters: string[][]): number {
  const columns = new Set<number>();

  for (let y = 0; y < letters.length; y += 1) {
    const row = letters[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      if (row[x]) {
        columns.add(x);
      }
    }
  }

  return columns.size;
}

function countOccupiedRows(letters: string[][]): number {
  return letters.filter((row) => row.some(Boolean)).length;
}
