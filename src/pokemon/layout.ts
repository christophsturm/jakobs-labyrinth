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

export type Artwork = {
  id: string;
  name: string;
  image: string;
  kind?: "card";
  caption?: string;
};
export type Sheet = (string | null)[];
export type PrintOptions = { names: boolean; scale: number; offsetX: number; offsetY: number };

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
            `<div class="print-sheet-page">${renderSheetSvg(sheet, format, artworks, options, page, -1)}</div>`,
          ]
        : [],
    )
    .join("");
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

export function renderSheetSvg(
  sheet: Sheet,
  format: LabelFormat,
  artworks: ReadonlyMap<string, Artwork>,
  options: PrintOptions,
  page: number,
  selected: number,
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
      <g clip-path="url(#${clipId})" class="label-content">
        ${
          artwork
            ? isCard
              ? `<g transform="translate(${width / 2} ${height / 2}) rotate(${rotateCard ? 90 : 0})"><image href="${escapeXml(artwork.image)}" x="${-cardWidth / 2}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" preserveAspectRatio="xMidYMid meet" /></g>`
              : `<image href="${escapeXml(artwork.image)}" x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet" />
        ${options.names ? `<text x="${width / 2}" y="${height - inset - 0.5}" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(3, (width - 2 * inset) / (name.length * 0.62))}" font-weight="600" fill="#24382e">${escapeXml(name)}</text>` : ""}`
            : `<text class="screen-only empty-slot" x="${width / 2}" y="${height / 2 + 1.5}" text-anchor="middle" font-size="5" fill="#bcc5be">+</text>`
        }
      </g>
      <rect class="screen-only label-outline${index === selected ? " is-selected" : ""}" x="0.3" y="0.3" width="${width - 0.6}" height="${height - 0.6}" fill="none" stroke="${index === selected ? "#c75632" : "#dfe3dd"}" stroke-width="${index === selected ? "0.7" : "0.25"}" stroke-dasharray="${index === selected ? "none" : "1 1"}" />
      <text class="screen-only slot-number" x="${width - 2}" y="4" text-anchor="end" font-size="2.2" fill="${index === selected ? "#b14322" : "#a8b3ab"}">${String(index + 1).padStart(2, "0")}</text>
    </g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="210mm" height="297mm" viewBox="0 0 210 297" aria-label="Etikettenbogen ${page + 1}" class="label-sheet"><g transform="translate(${options.offsetX} ${options.offsetY})">${labels.join("")}</g></svg>`;
}
