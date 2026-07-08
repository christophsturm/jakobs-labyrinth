import { describe, expect, test } from "vitest";
import { generatePuzzle, normalizeWord, pointKey, renderSvg, type Puzzle } from "./main";

describe("normalizeWord", () => {
  test("keeps German uppercase letters and removes separators", () => {
    expect(normalizeWord("  Eis-Bär 42! ")).toBe("EISBÄR");
    expect(normalizeWord("straße")).toBe("STRASSE");
  });
});

describe("generatePuzzle", () => {
  test("places the solution word along a non-repeating orthogonal path", () => {
    const puzzle = generatePuzzle({
      word: "DRACHE",
      cols: 10,
      difficulty: "medium",
      seed: 1234,
    });

    expect(puzzle.word).toBe("DRACHE");
    expect(puzzle.solutionPath).toHaveLength(6);
    expect(new Set(puzzle.solutionPath.map(pointKey))).toHaveLength(6);

    for (let index = 0; index < puzzle.word.length; index += 1) {
      const point = puzzle.solutionPath[index];
      const expectedLetter = puzzle.word[index];

      expect(point).toBeDefined();
      expect(expectedLetter).toBeDefined();

      if (!point || !expectedLetter) {
        throw new Error("Missing test fixture data.");
      }

      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(puzzle.cols);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThan(puzzle.rows);
      expect(puzzle.letters[point.y]?.[point.x]).toBe(expectedLetter);

      const next = puzzle.solutionPath[index + 1];

      if (next) {
        expect(Math.abs(next.x - point.x) + Math.abs(next.y - point.y)).toBe(1);
      }
    }
  });

  test("is deterministic when a seed is provided", () => {
    const first = generatePuzzle({
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });
    const second = generatePuzzle({
      word: "KOMET",
      cols: 8,
      difficulty: "hard",
      seed: 98765,
    });

    expect(second.solutionPath).toEqual(first.solutionPath);
    expect(second.letters).toEqual(first.letters);
  });

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
  test("escapes dynamic text and hides the solution line by default", () => {
    const puzzle: Puzzle = {
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
    };

    const svg = renderSvg(puzzle, { showSolution: false });

    expect(svg).toContain("&lt;BAD&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("<polyline");
  });
});
