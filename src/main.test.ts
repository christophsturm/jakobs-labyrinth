import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  baseUrlFromLocation,
  createPuzzleCollectionUrlSearchParams,
  createPuzzleUrlSearchParams,
  generateMazePuzzle,
  generatePuzzle,
  generateWordSearchPuzzle,
  languageFromLocales,
  makeSeed,
  normalizeWord,
  normalizeWordWithFeedback,
  pathSpellsWord,
  pointKey,
  parsePuzzleSettingsFromUrl,
  parsePuzzleSettingsFromUrlWithIssues,
  parseAdditionalPuzzleSettingsFromUrl,
  renderAnswerBoxesHtml,
  renderInteractivePuzzlesHtml,
  renderPrintablePuzzlesHtml,
  renderSvg,
  type MazePuzzle,
  type Point,
  type PuzzleLanguage,
  type WordSearchPuzzle,
} from "./main";

const packageJsonFile = new URL("../package.json", import.meta.url);
const sourceIndexHtmlFile = new URL("index.html", import.meta.url);

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

describe("puzzle URL settings", () => {
  test("removes puzzle state from the printed base URL", () => {
    expect(
      baseUrlFromLocation("https://example.com/jakobs-labyrinth/?kind=maze&word=DRACHE#solution"),
    ).toBe("https://example.com/jakobs-labyrinth/");
  });

  test("serializes all shareable settings except language", () => {
    const params = createPuzzleUrlSearchParams({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      mazeLetterAmount: "many",
      seed: 4321,
      savedSeeds: [111, 222],
    });

    expect(Object.fromEntries(params)).toEqual({
      kind: "maze",
      word: "RFJBQ0hF",
      size: "10",
      difficulty: "medium",
      letters: "many",
      seed: "4321",
      saved: "111,222",
    });
    expect(params.has("language")).toBe(false);
    expect(params.toString()).not.toContain("DRACHE");
    expect(parsePuzzleSettingsFromUrl(params)).toEqual({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      mazeLetterAmount: "many",
      seed: 4321,
      savedSeeds: [111, 222],
    });
  });

  test("validates external URL parameters and ignores invalid values", () => {
    expect(
      parsePuzzleSettingsFromUrl(
        "?kind=nope&word=%20%20&size=999&difficulty=evil&letters=all&seed=-5&language=en",
      ),
    ).toEqual({});
    expect(parsePuzzleSettingsFromUrl("?kind=maze&size=8&seed=4321&language=fr")).toEqual({
      kind: "maze",
      cols: 8,
      seed: 4321,
    });
    expect(parsePuzzleSettingsFromUrl("?kind=maze&word=SCHLUMPF&size=10&seed=4321")).toEqual({
      kind: "maze",
      word: "SCHLUMPF",
      cols: 10,
      seed: 4321,
    });
  });

  test("reports invalid known URL parameters while preserving valid ones", () => {
    expect(
      parsePuzzleSettingsFromUrlWithIssues(
        "?kind=nope&word=DRACHE&size=999&difficulty=medium&letters=all&seed=4321&saved=1,nope&language=en",
      ),
    ).toEqual({
      settings: {
        word: "DRACHE",
        difficulty: "medium",
        seed: 4321,
      },
      invalidParams: [
        { name: "kind", value: "nope" },
        { name: "size", value: "999" },
        { name: "letters", value: "all" },
        { name: "saved", value: "1,nope" },
      ],
    });
    expect(parsePuzzleSettingsFromUrlWithIssues("?language=fr&theme=dark")).toEqual({
      settings: {},
      invalidParams: [],
    });
  });

  test("reproduces a maze from parsed URL settings", () => {
    const settings = parsePuzzleSettingsFromUrl(
      "?kind=maze&word=RFJBQ0hF&size=10&difficulty=medium&letters=normal&seed=4321",
    );

    if (
      !settings.kind ||
      !settings.word ||
      !settings.cols ||
      !settings.difficulty ||
      !settings.mazeLetterAmount ||
      !settings.seed
    ) {
      throw new Error("Expected complete URL settings.");
    }

    const first = generateMazePuzzle({
      kind: settings.kind,
      word: settings.word,
      cols: settings.cols,
      difficulty: settings.difficulty,
      mazeLetterAmount: settings.mazeLetterAmount,
      seed: settings.seed,
    });
    const second = generateMazePuzzle({
      kind: settings.kind,
      word: settings.word,
      cols: settings.cols,
      difficulty: settings.difficulty,
      mazeLetterAmount: settings.mazeLetterAmount,
      seed: settings.seed,
    });

    expect(second.solutionPath).toEqual(first.solutionPath);
    expect(second.letters).toEqual(first.letters);
    expect(second.maze).toEqual(first.maze);
  });

  test("validates URL settings before writing", () => {
    const base = {
      kind: "maze" as const,
      word: "DRACHE",
      cols: 10,
      difficulty: "medium" as const,
      mazeLetterAmount: "normal" as const,
      seed: 4321,
    };

    expect(() => createPuzzleUrlSearchParams({ ...base, cols: 6 })).toThrow();
    expect(() => createPuzzleUrlSearchParams({ ...base, seed: 0 })).toThrow();
    expect(() => createPuzzleUrlSearchParams({ ...base, savedSeeds: [1, 0] })).toThrow();
  });

  test("round-trips additional puzzles with their own settings", () => {
    const first = generateMazePuzzle({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      mazeLetterAmount: "many",
      seed: 4321,
    });
    const second = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });
    const params = createPuzzleCollectionUrlSearchParams([first, second]);

    expect(params.getAll("puzzle")).toHaveLength(1);
    expect(parsePuzzleSettingsFromUrl(params)).toMatchObject({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      mazeLetterAmount: "many",
      seed: 4321,
    });
    expect(parseAdditionalPuzzleSettingsFromUrl(params)).toEqual({
      entries: [
        {
          kind: "wordSearch",
          word: "KOMET",
          cols: 8,
          difficulty: "hard",
          mazeLetterAmount: "normal",
          seed: 98765,
        },
      ],
      invalidParams: [],
    });
  });

  test("rejects malformed additional puzzle settings", () => {
    expect(parseAdditionalPuzzleSettingsFromUrl("?puzzle=not-valid-json")).toEqual({
      entries: [],
      invalidParams: [{ name: "puzzle", value: "not-valid-json" }],
    });
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

  test("draws sparse maze letters, opening arrows, and hides the solution line by default", () => {
    const word = "Gargamelschlumpf";
    const normalizedWord = "GARGAMELSCHLUMPF";
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word,
      cols: 10,
      difficulty: "easy",
      mazeLetterAmount: "few",
      seed: 14,
    });

    const hidden = renderSvg(puzzle, { showSolution: false });
    const visible = renderSvg(puzzle, { showSolution: true });

    expect(hidden).toContain("<line");
    expect(hidden).toContain('class="maze-opening-arrow maze-opening-entrance"');
    expect(hidden).toContain('class="maze-opening-arrow maze-opening-exit"');
    expect(hidden).not.toContain("Eingang");
    expect(hidden).not.toContain("Ausgang");
    expect(hidden).not.toContain(`${normalizedWord}</title>`);
    expect(hidden).not.toContain(`für ${normalizedWord}`);
    expect(hidden).not.toContain("<polyline");
    expect(visible).toContain("<polyline");
    expect(pathSpellsWord(puzzle)).toBe(normalizedWord);
    expect(countLetters(puzzle.letters)).toBeLessThanOrEqual(normalizedWord.length);
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
    expect(renderSvg(french, { showSolution: false })).not.toContain("Entrée");
    expect(renderSvg(french, { showSolution: false })).not.toContain("Sortie");
    expect(renderSvg(italian, { showSolution: true })).toContain("Cerca parole");
    expect(renderSvg(italian, { showSolution: true })).toContain("<polyline");
    expect(renderSvg(italian, { showSolution: true })).not.toContain("Inizio");
    expect(renderSvg(italian, { showSolution: true })).not.toContain("Fine");
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

describe("renderPrintablePuzzlesHtml", () => {
  test("renders multiple printable pages without visible maze solutions", () => {
    const first = generateMazePuzzle({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });
    const second = generateMazePuzzle({
      kind: "maze",
      word: "Gargamelschlumpf",
      cols: 10,
      difficulty: "easy",
      seed: 14,
    });

    const html = renderPrintablePuzzlesHtml(
      [first, second],
      "https://example.com/jakobs-labyrinth/",
    );

    expect(html.match(/class="print-page"/g)).toHaveLength(2);
    expect(html).not.toContain("<polyline");
    expect(html.match(/class="answer-box"/g)).toHaveLength(first.word.length + second.word.length);
    expect(html.match(/class="print-source"/g)).toHaveLength(2);
    expect(html).toContain("Erstellt mit https://example.com/jakobs-labyrinth/");
  });
});

describe("renderInteractivePuzzlesHtml", () => {
  test("adds a localized delete control to every puzzle and marks the demo", () => {
    const first = generateMazePuzzle({
      kind: "maze",
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 4321,
    });
    const second = generateWordSearchPuzzle({
      kind: "wordSearch",
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });
    const html = renderInteractivePuzzlesHtml([first, second], {
      showSolution: false,
      showDemoBadge: true,
      printSourceUrl: "https://example.com/jakobs-labyrinth/",
    });

    expect(html.match(/class="delete-puzzle"/g)).toHaveLength(2);
    expect(html).toContain('data-puzzle-index="0"');
    expect(html).toContain('aria-label="Puzzle 1 löschen"');
    expect(html.match(/class="demo-badge"/g)).toHaveLength(1);
    expect(renderPrintablePuzzlesHtml([first, second])).not.toContain("delete-puzzle");
  });
});

describe("project configuration", () => {
  test("formatter scripts scan the project instead of enumerating today's files", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonFile, "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.fmt).toBe("oxfmt .");
    expect(packageJson.scripts["fmt:check"]).toBe("oxfmt --check .");
  });

  test("print CSS hides SVG solution layers", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");

    expect(html).toContain(".print-hidden-solution");
    expect(html).toMatch(/@media print[\s\S]*\.print-hidden-solution[\s\S]*display:\s*none/);
  });

  test("includes a language selector with the supported languages", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");

    expect(html).toContain('select id="language"');
    expect(html).toContain('value="en"');
    expect(html).toContain('value="it"');
    expect(html).toContain('value="fr"');
  });

  test("keeps sidebar controls shrinkable after long localized labels", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");

    expect(html).toMatch(/label\s*\{[\s\S]*min-width:\s*0/);
    expect(html).toMatch(/input,\s*select\s*\{[\s\S]*min-width:\s*0/);
  });

  test("uses one visible worksheet list for screen and print", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");
    const printCss = html.slice(html.indexOf("@media print"));

    expect(html).toContain('id="worksheets"');
    expect(html).not.toContain("print-stack");
    expect(printCss).toMatch(/\.controls\s*\{[\s\S]*display:\s*none/);
    expect(cssRuleBody(printCss, ".app")).toContain("display: block");
    expect(cssRuleBody(printCss, ".app")).not.toContain("display: none");
  });

  test("uses one primary puzzle action instead of separate generate and save buttons", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");

    expect(html).toContain('button id="add-puzzle"');
    expect(html).not.toContain('button id="generate"');
    expect(html).not.toContain('button id="save-next"');
  });

  test("links to the GitHub repository and shows the base URL only when printing", () => {
    const html = readFileSync(sourceIndexHtmlFile, "utf8");
    const printCss = html.slice(html.indexOf("@media print"));

    expect(html).toContain('href="https://github.com/christophsturm/jakobs-labyrinth"');
    expect(html).toMatch(/\.print-source\s*\{[\s\S]*display:\s*none/);
    expect(printCss).toMatch(/\.print-source\s*\{[\s\S]*display:\s*block/);
  });
});

function cssRuleBody(html: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\}`).exec(html);

  return match?.groups?.body ?? "";
}

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
