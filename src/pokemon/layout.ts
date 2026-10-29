export type LabelFormat = {
  id: string;
  name: string;
  columns: number;
  rows: number;
  width: number;
  height: number;
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
};

// All dimensions are millimetres. Add further stock formats here.
export const labelFormats: readonly LabelFormat[] = [
  {
    id: "zweckform-24",
    name: "Zweckform · 24 Etiketten · 70 × 37,125 mm",
    columns: 3,
    rows: 8,
    width: 70,
    height: 37.125,
    marginX: 0,
    marginY: 0,
    gapX: 0,
    gapY: 0,
  },
];

export const defaultFormat = labelFormats[0]!;

type Viewport = { x: number; y: number; width: number; height: number };
const sheetViewport: Viewport = { x: 0, y: 0, width: 210, height: 297 };
// Matches the 3 mm @page margin, with 0.5 mm pagination tolerance at the bottom.
// Cropping the viewport preserves millimetres without an oversized SVG or CSS offsets.
const printViewport: Viewport = { x: 3, y: 3, width: 204, height: 290.5 };

export type Artwork = {
  id: string;
  name: string;
  image: string;
  kind?: "card";
  caption?: string;
  aliases?: readonly string[];
};
export type Sheet = (string | null)[];
export type PrintOptions = { names: boolean; scale: number; offsetX: number; offsetY: number };

export function fitLabelsToA4(
  grid: Pick<LabelFormat, "columns" | "rows" | "marginX" | "marginY" | "gapX" | "gapY">,
): LabelFormat {
  const format = {
    ...grid,
    id: "custom",
    name: "Eigenes A4-Format",
    width: (210 - 2 * grid.marginX - (grid.columns - 1) * grid.gapX) / grid.columns,
    height: (297 - 2 * grid.marginY - (grid.rows - 1) * grid.gapY) / grid.rows,
  };
  const error = formatError(format);
  if (error) throw new RangeError(error);
  return format;
}

export function formatError(format: LabelFormat): string | null {
  const { columns, rows, width, height, marginX, marginY, gapX, gapY } = format;
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns * rows > 120
  ) {
    return "Bitte ganze Spalten und Reihen mit insgesamt 1 bis 120 Etiketten eingeben.";
  }
  if (
    ![width, height, marginX, marginY, gapX, gapY].every(Number.isFinite) ||
    width < 10 ||
    height < 10 ||
    Math.min(marginX, marginY, gapX, gapY) < 0
  ) {
    return "Etiketten müssen mindestens 10 mm groß sein. Ränder und Abstände dürfen nicht negativ sein.";
  }
  if (
    marginX + columns * width + (columns - 1) * gapX > 210.00001 ||
    marginY + rows * height + (rows - 1) * gapY > 297.00001
  ) {
    return "Dieses Raster passt nicht auf A4 (210 × 297 mm). Bitte Maße, Ränder oder Abstände verkleinern.";
  }
  return null;
}

export function labelPositions(
  format: LabelFormat,
): { x: number; y: number; width: number; height: number }[] {
  const error = formatError(format);
  if (error) throw new RangeError(error);
  return Array.from({ length: format.columns * format.rows }, (_, index) => ({
    x: format.marginX + (index % format.columns) * (format.width + format.gapX),
    y: format.marginY + Math.floor(index / format.columns) * (format.height + format.gapY),
    width: format.width,
    height: format.height,
  }));
}

export function emptySheet(format: LabelFormat): Sheet {
  return labelPositions(format).map(() => null);
}

// Keep intentional gaps (e.g. already used stickers) when changing formats.
export function reflowSheets(sheets: readonly Sheet[], format: LabelFormat): Sheet[] {
  const capacity = labelPositions(format).length;
  const slots = sheets.flat();
  while (slots.length > capacity && slots.at(-1) === null) slots.pop();
  return Array.from({ length: Math.max(1, Math.ceil(slots.length / capacity)) }, (_, page) =>
    Array.from({ length: capacity }, (_, slot) => slots[page * capacity + slot] ?? null),
  );
}

export function fillEmptySlots(sheet: Sheet, artworkId: string): Sheet {
  return sheet.map((slot) => slot ?? artworkId);
}

export function swapSlots(sheet: Sheet, source: number, target: number): Sheet {
  if (
    !Number.isInteger(source) ||
    !Number.isInteger(target) ||
    source < 0 ||
    target < 0 ||
    source >= sheet.length ||
    target >= sheet.length ||
    !sheet[source] ||
    source === target
  )
    return sheet;
  const result = [...sheet];
  result[source] = sheet[target] ?? null;
  result[target] = sheet[source]!;
  return result;
}

export function renderPrintSheets(
  sheets: readonly Sheet[],
  format: LabelFormat,
  artworks: ReadonlyMap<string, Artwork>,
  options: PrintOptions,
): string {
  return sheets
    .flatMap((sheet, page) =>
      sheet.some(Boolean)
        ? [
            `<div class="print-sheet-page">${renderSheetSvg(sheet, format, artworks, options, page, -1, printViewport)}</div>`,
          ]
        : [],
    )
    .join("");
}

export function renderCalibrationSheet(format: LabelFormat, options: PrintOptions): string {
  const marks = labelPositions(format)
    .map(({ x, y, width, height }, index) => {
      const cx = x + width / 2;
      const cy = y + height / 2;
      return `<g data-calibration-slot="${index}" transform="translate(${cx} ${cy})"><path d="M -4 0 H 4 M 0 -4 V 4" fill="none" stroke="black" stroke-width="0.2" /><text x="5" y="-1" font-size="2.5">${index + 1}</text></g>`;
    })
    .join("");
  const content = `<g fill="black" font-family="sans-serif">
    <text x="105" y="7" text-anchor="middle" font-size="3.5">Etiketten-Testblatt · A4 · 100 %</text>
    <text x="105" y="11" text-anchor="middle" font-size="2.5">Kreuze = Etikettenmitten · Beide Messstrecken müssen genau 100 mm lang sein.</text>
    <g transform="translate(${options.offsetX} ${options.offsetY})">${marks}</g>
    <path d="M 55 287 V 291 M 55 289 H 155 M 155 287 V 291 M 200 98.5 H 204 M 202 98.5 V 198.5 M 200 198.5 H 204" fill="none" stroke="black" stroke-width="0.2" />
    <text x="105" y="286" text-anchor="middle" font-size="3">100 mm</text>
    <text transform="translate(200 148.5) rotate(-90)" text-anchor="middle" font-size="3">100 mm</text>
  </g>`;
  return `<div class="print-sheet-page">${svgFrame(content, "Etiketten-Testblatt", printViewport)}</div>`;
}

export function nextEmptySlot(sheet: Sheet, current: number): number {
  for (let step = 1; step < sheet.length; step++) {
    const next = (current + step) % sheet.length;
    if (sheet[next] === null) return next;
  }
  return current;
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

function svgFrame(content: string, label: string, viewport: Viewport): string {
  const { x, y, width, height } = viewport;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}mm" height="${height}mm" viewBox="${x} ${y} ${width} ${height}" aria-label="${label}" class="label-sheet">${content}</svg>`;
}

export function renderSheetSvg(
  sheet: Sheet,
  format: LabelFormat,
  artworks: ReadonlyMap<string, Artwork>,
  options: PrintOptions,
  page: number,
  selected: number,
  viewport: Viewport = sheetViewport,
): string {
  const labels = labelPositions(format).map(({ x, y, width, height }, index) => {
    const artwork = artworks.get(sheet[index] ?? "");
    const inset = Math.min(4, width / 8, height / 8);
    const isCard = artwork?.kind === "card";
    const nameHeight = options.names && artwork && !isCard ? 5 : 0;
    const imageSize =
      (Math.min(width - 2 * inset, height - 2 * inset - nameHeight) * options.scale) / 100;
    const imageX = (width - imageSize) / 2;
    const imageY = (height - nameHeight - imageSize) / 2;
    const name = artwork?.name ?? "Leer";
    const clipId = `label-clip-${page}-${index}`;
    const rotateCard = isCard && width > height;
    const cardWidth =
      (Math.min(
        rotateCard ? height - 2 * inset : width - 2 * inset,
        ((rotateCard ? width - 2 * inset : height - 2 * inset) * 63) / 88,
      ) *
        options.scale) /
      100;
    const cardHeight = (cardWidth * 88) / 63;
    return `<g transform="translate(${x} ${y})" data-slot="${index}" data-filled="${Boolean(artwork)}" role="button" tabindex="${index === selected ? 0 : -1}" aria-label="Etikett ${index + 1}: ${escapeXml(name)}" aria-describedby="sheet-help" aria-pressed="${index === selected}">
      <rect class="label-hit" width="${width}" height="${height}" fill="transparent" />
      <clipPath id="${clipId}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" /></clipPath>
      <g class="label-content" transform="translate(${options.offsetX} ${options.offsetY})"><g clip-path="url(#${clipId})">
        ${
          artwork
            ? isCard
              ? `<g transform="translate(${width / 2} ${height / 2}) rotate(${rotateCard ? 90 : 0})"><image href="${escapeXml(artwork.image)}" x="${-cardWidth / 2}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" preserveAspectRatio="xMidYMid meet" /></g>`
              : `<image href="${escapeXml(artwork.image)}" x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet" />
        ${options.names ? `<text x="${width / 2}" y="${height - inset - 0.5}" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(3, (width - 2 * inset) / (name.length * 0.62))}" font-weight="600" fill="#24382e">${escapeXml(name)}</text>` : ""}`
            : `<text class="screen-only empty-slot" x="${width / 2}" y="${height / 2 + 1.5}" text-anchor="middle" font-size="5" fill="#bcc5be">+</text>`
        }
      </g></g>
      <rect class="screen-only label-outline${index === selected ? " is-selected" : ""}" x="0.3" y="0.3" width="${width - 0.6}" height="${height - 0.6}" fill="none" stroke="${index === selected ? "#c75632" : "#dfe3dd"}" stroke-width="${index === selected ? "0.7" : "0.25"}" stroke-dasharray="${index === selected ? "none" : "1 1"}" />
      <text class="screen-only slot-number" x="${width - 2}" y="4" text-anchor="end" font-size="2.2" fill="${index === selected ? "#b14322" : "#a8b3ab"}">${String(index + 1).padStart(2, "0")}</text>
    </g>`;
  });
  return svgFrame(labels.join(""), `Etikettenbogen ${page + 1}`, viewport);
}
