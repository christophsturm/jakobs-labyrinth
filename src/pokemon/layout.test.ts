import { describe, expect, test } from "vitest";
import {
  defaultFormat,
  emptySheet,
  fillEmptySlots,
  fitLabelsToA4,
  formatError,
  labelPositions,
  nextEmptySlot,
  reflowSheets,
  renderSheetSvg,
  renderPrintSheets,
  renderCalibrationSheet,
  swapSlots,
  type Artwork,
} from "./layout";

describe("physical label layout", () => {
  test("derives full-sheet labels from the row and column counts", () => {
    const grid = { columns: 2, rows: 4, marginX: 0, marginY: 0, gapX: 0, gapY: 0 };
    expect(fitLabelsToA4(grid)).toMatchObject({ width: 105, height: 74.25 });
    expect(fitLabelsToA4({ ...grid, columns: 3, rows: 8 })).toMatchObject({
      width: 70,
      height: 37.125,
    });
    const thirds = fitLabelsToA4({ ...grid, columns: 6, rows: 7 });
    const last = labelPositions(thirds).at(-1)!;
    expect(last.x + last.width).toBeCloseTo(210, 8);
    expect(last.y + last.height).toBeCloseTo(297, 8);
  });

  test("subtracts both outer margins and all internal gaps when fitting labels", () => {
    const format = fitLabelsToA4({
      columns: 2,
      rows: 4,
      marginX: 5,
      marginY: 10,
      gapX: 2,
      gapY: 3,
    });
    expect(format).toMatchObject({ width: 99, height: 67 });
    const last = labelPositions(format).at(-1)!;
    expect(last.x + last.width).toBe(205);
    expect(last.y + last.height).toBe(287);
    expect(() => fitLabelsToA4({ ...format, columns: 0 })).toThrow(RangeError);
    expect(() => fitLabelsToA4({ ...format, marginX: 110 })).toThrow(RangeError);
  });
  test("covers A4 with exactly 24 labels without margins or gaps", () => {
    const positions = labelPositions(defaultFormat);
    expect(positions).toHaveLength(24);
    expect(positions[0]).toEqual({ x: 0, y: 0, width: 70, height: 37.125 });
    expect(positions[3]).toEqual({ x: 0, y: 37.125, width: 70, height: 37.125 });
    const last = positions.at(-1)!;
    expect(last.x + last.width).toBe(210);
    expect(last.y + last.height).toBe(297);
    expect(positions.reduce((area, { width, height }) => area + width * height, 0)).toBe(210 * 297);
  });

  test("accounts for margins and gutters in other label stocks", () => {
    const format = {
      ...defaultFormat,
      columns: 2,
      rows: 7,
      width: 90,
      height: 35,
      marginX: 10,
      marginY: 12,
      gapX: 5,
      gapY: 3,
    };
    const positions = labelPositions(format);
    expect(positions[1]).toMatchObject({ x: 105, y: 12 });
    expect(positions[2]).toMatchObject({ x: 10, y: 50 });
    expect(formatError(format)).toBeNull();
  });

  test.each([
    { columns: 3.5 },
    { rows: 0 },
    { rows: Infinity },
    { width: NaN },
    { width: 71 },
    { height: 37.126 },
    { marginX: 1 },
    { gapY: 1 },
    { gapX: -1 },
    { height: 2 },
  ])("rejects invalid or overflowing geometry: %j", (change) => {
    expect(formatError({ ...defaultFormat, ...change })).toBeTypeOf("string");
    expect(() => labelPositions({ ...defaultFormat, ...change })).toThrow(RangeError);
  });
});

describe("sheet editing", () => {
  test("moves and swaps without losing pictures or shifting unused stickers", () => {
    const sheet = ["25", null, "4", null];
    const moved = swapSlots(sheet, 0, 3);
    expect(moved).toEqual([null, null, "4", "25"]);
    expect(swapSlots(moved, 3, 2)).toEqual([null, null, "25", "4"]);
    expect(sheet).toEqual(["25", null, "4", null]);
  });
  test("leaves labels unchanged when dropping outside or on the source", () => {
    const sheet = ["25", null, "4"];
    for (const [source, target] of [
      [0, -1],
      [0, 3],
      [0, 0],
      [1, 2],
    ]) {
      expect(swapSlots(sheet, source!, target!)).toBe(sheet);
    }
  });
  test("fills only empty stickers, preserving already assigned positions", () => {
    const original = ["1", null, "4", null];
    expect(fillEmptySlots(original, "25")).toEqual(["1", "25", "4", "25"]);
    expect(original).toEqual(["1", null, "4", null]);
  });
  test("advances to the next free label and wraps around", () => {
    expect(nextEmptySlot([null, "1", "2", null], 1)).toBe(3);
    expect(nextEmptySlot([null, "1", "2", "3"], 2)).toBe(0);
    expect(nextEmptySlot(["1", "2"], 1)).toBe(1);
  });
  test("retains intentional blanks when moving labels to smaller sheets", () => {
    const first = emptySheet(defaultFormat);
    first[0] = "25";
    first[23] = "151";
    const smaller = { ...defaultFormat, columns: 2, rows: 3 };
    const result = reflowSheets([first], smaller);
    expect(result).toHaveLength(4);
    expect(result.flat()).toEqual(first);
  });
  test("combines sheets without losing labels and pads the last sheet", () => {
    const result = reflowSheets(
      [
        ["25", null],
        ["1", "4"],
      ],
      defaultFormat,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(24);
    expect(result[0]!.slice(0, 5)).toEqual(["25", null, "1", "4", null]);
  });
});

describe("SVG print output", () => {
  const artworks = new Map<string, Artwork>([
    ["25", { id: "25", name: 'Pika <&"chu', image: "data:image/webp;base64,aGVsbG8=" }],
  ]);
  const sheet = emptySheet(defaultFormat);
  sheet[0] = "25";
  test("uses physical A4 dimensions, embedded images, and unique clipping per sheet", () => {
    const svg = renderSheetSvg(
      sheet,
      defaultFormat,
      artworks,
      { names: false, scale: 100, offsetX: 1.2, offsetY: -0.5 },
      2,
      0,
    );
    expect(svg).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
    expect(svg).toContain('transform="translate(1.2 -0.5)"');
    expect(svg).toContain('id="label-clip-2-0"');
    expect(svg).toContain('href="data:image/webp;base64,aGVsbG8="');
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).not.toContain(">Pika");
  });
  test("escapes uploaded filenames when showing names", () => {
    const svg = renderSheetSvg(
      sheet,
      defaultFormat,
      artworks,
      { names: true, scale: 75, offsetX: 0, offsetY: 0 },
      0,
      0,
    );
    expect(svg).toContain(">Pika &lt;&amp;&quot;chu</text>");
    expect(svg).not.toContain('>Pika <&"chu');
  });
  test("prints only nonempty sheets even with empty pages before and after", () => {
    const empty = emptySheet(defaultFormat);
    const options = { names: false, scale: 100, offsetX: 0, offsetY: 0 };
    const html = renderPrintSheets(
      [empty, sheet, empty, sheet, empty],
      defaultFormat,
      artworks,
      options,
    );
    expect(html.match(/class="print-sheet-page"/g)).toHaveLength(2);
    expect(html.match(/<image /g)).toHaveLength(2);
    expect(html).toContain('id="label-clip-1-0"');
    expect(html).toContain('id="label-clip-3-0"');
    // The physical SVG size matches its viewBox span, so every unit stays 1 mm.
    expect(html).toContain('width="204mm" height="290.5mm" viewBox="3 3 204 290.5"');
    expect(html).not.toContain('width="210mm"');
    expect(renderPrintSheets([empty], defaultFormat, artworks, options)).toBe("");
  });
  test("keeps label guides fixed while offsetting the artwork", () => {
    const svg = renderSheetSvg(
      sheet,
      defaultFormat,
      artworks,
      { names: false, scale: 100, offsetX: 2, offsetY: -3 },
      0,
      0,
    );
    expect(svg).toContain('<g transform="translate(0 0)" data-slot="0"');
    expect(svg).toContain('<g transform="translate(0 37.125)" data-slot="3"');
    expect(svg.match(/class="label-content" transform="translate\(2 -3\)"/g)).toHaveLength(24);
    expect(svg).not.toContain('class="label-sheet"><g transform="translate(2 -3)"');
  });
  test("prints a single calibration page with all centres and two 100 mm rulers", () => {
    const html = renderCalibrationSheet(defaultFormat, {
      names: false,
      scale: 40,
      offsetX: 0,
      offsetY: -2,
    });
    expect(html.match(/class="print-sheet-page"/g)).toHaveLength(1);
    expect(html.match(/data-calibration-slot=/g)).toHaveLength(24);
    expect(html).toContain('data-calibration-slot="0" transform="translate(35 18.5625)"');
    expect(html).toContain('data-calibration-slot="23" transform="translate(175 278.4375)"');
    expect(html).toContain('transform="translate(0 -2)"');
    expect(html).toContain("M 55 289 H 155");
    expect(html).toContain("M 202 98.5 V 198.5");
    expect(html).not.toContain("<image");
  });
  test("rotates a full card for landscape labels and retains an upright card on portrait labels", () => {
    const cards = new Map<string, Artwork>([
      [
        "card",
        { id: "card", name: "Glurak-ex", image: "data:image/webp;base64,Y2FyZA==", kind: "card" },
      ],
    ]);
    const options = { names: true, scale: 100, offsetX: 0, offsetY: 0 };
    const landscape = renderSheetSvg(["card"], defaultFormat, cards, options, 0, 0);
    expect(landscape).toContain("rotate(90)");
    expect(landscape).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(landscape).not.toContain(">Glurak-ex</text>");
    const portrait = { ...defaultFormat, columns: 1, rows: 1, width: 37.125, height: 70 };
    expect(renderSheetSvg(["card"], portrait, cards, options, 0, 0)).toContain("rotate(0)");
  });
});
