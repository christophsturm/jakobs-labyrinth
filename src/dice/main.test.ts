import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { rollColorAndShape, rollNumericDice } from "./main";

const sourceHtmlFile = new URL("index.html", import.meta.url);

describe("rollNumericDice", () => {
  test("rolls the requested amount and number of sides", () => {
    const values = [0, 0.49, 0.999];
    let index = 0;

    expect(rollNumericDice(3, 6, () => values[index++] ?? 0)).toEqual([1, 3, 6]);
  });

  test("rejects unsupported amounts", () => {
    expect(() => rollNumericDice(0, 6)).toThrow(RangeError);
    expect(() => rollNumericDice(13, 6)).toThrow(RangeError);
    expect(() => rollNumericDice(2, 1)).toThrow(RangeError);
  });
});

describe("rollColorAndShape", () => {
  test("rolls color and shape independently", () => {
    const values = [0.75, 0.5];
    let index = 0;
    const result = rollColorAndShape(() => values[index++] ?? 0);

    expect(result.color.id).toBe("blue");
    expect(result.shape.id).toBe("square");
  });
});

describe("dice tool page", () => {
  test("offers all requested presets and keyboard rolling without third-party branding", () => {
    const html = readFileSync(sourceHtmlFile, "utf8");

    expect(html).toContain('value="color-shape"');
    expect(html).toContain('value="kniffel"');
    expect(html).toContain('value="double-six"');
    expect(html).toContain('value="custom"');
    expect(html).toContain('aria-keyshortcuts="Space"');
    expect(html.toLowerCase()).not.toContain("colorama");
  });
});
