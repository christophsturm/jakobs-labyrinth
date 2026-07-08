import { describe, expect, test } from "vitest";
import {
  generateMazePuzzle,
  generatePuzzle,
  generateWordSearchPuzzle,
  normalizeWord,
  pathSpellsWord,
  pointKey,
  renderSvg,
  type MazePuzzle,
  type Point,
  type WordSearchPuzzle,
} from "./main";

describe("normalizeWord", () => {
  test("keeps German uppercase letters and removes separators", () => {
    expect(normalizeWord("  Eis-Bär 42! ")).toBe("EISBÄR");
    expect(normalizeWord("straße")).toBe("STRASSE");
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
    expect(countLetters(puzzle.letters)).toBeLessThanOrEqual(9);
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
});

describe("renderSvg", () => {
  test("escapes dynamic text and hides the word-search solution line by default", () => {
    const puzzle: WordSearchPuzzle = {
      kind: "wordSearch",
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
    expect(svg).not.toContain("<polyline");
  });

  test("draws sparse maze letters, wall openings, and hides the solution line by default", () => {
    const puzzle = generateMazePuzzle({
      kind: "maze",
      word: "TOR",
      cols: 6,
      difficulty: "easy",
      seed: 14,
    });

    const hidden = renderSvg(puzzle, { showSolution: false });
    const visible = renderSvg(puzzle, { showSolution: true });

    expect(hidden).toContain("<line");
    expect(hidden).toContain("Eingang");
    expect(hidden).toContain("Ausgang");
    expect(hidden).not.toContain("<polyline");
    expect(visible).toContain("<polyline");
    expect(countLetters(puzzle.letters)).toBeLessThanOrEqual(3);
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
