/// <reference types="vite/client" />
import catalogEntries from "./catalog.json";
import cardEntries from "./cards.json";
import {
  defaultFormat,
  emptySheet,
  fillEmptySlots,
  formatError,
  labelFormats,
  nextEmptySlot,
  reflowSheets,
  renderSheetSvg,
  renderPrintSheets,
  swapSlots,
  type Artwork,
  type LabelFormat,
  type PrintOptions,
  type Sheet,
} from "./layout";

const imageModules = import.meta.glob<string>("./artwork/*.webp", {
  eager: true,
  query: "?inline",
  import: "default",
});
const favorites = [
  25, 1, 4, 7, 133, 39, 52, 54, 94, 143, 150, 151, 6, 9, 37, 58, 77, 104, 131, 132, 134, 135, 136,
  149,
];
const artworks = new Map<string, Artwork>(
  catalogEntries.map(({ id, name }) => {
    const image = imageModules[`./artwork/${id}.webp`];
    if (!image) throw new Error(`Bild für ${name} fehlt.`);
    return [String(id), { id: String(id), name, image }];
  }),
);
const englishNames = new Map(catalogEntries.map(({ id, english }) => [String(id), english]));
const cardImages = import.meta.glob<string>("./cards/*.webp", {
  eager: true,
  query: "?inline",
  import: "default",
});
for (const card of cardEntries) {
  const image = cardImages[`./cards/${card.id}.webp`];
  if (!image) throw new Error(`Karte ${card.id} fehlt.`);
  artworks.set(card.id, {
    id: card.id,
    name: card.name,
    image,
    kind: "card",
    caption: `${card.set} · ${card.number}`,
  });
}

type EditorState = { format: LabelFormat; sheets: Sheet[]; page: number; selected: number };
type LabelDrag = {
  pointerId: number;
  source: number;
  page: number;
  startX: number;
  startY: number;
  dragging: boolean;
  ghost: HTMLImageElement | null;
};

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element ${id} fehlt.`);
  return element as T;
}

function start(): void {
  const catalog = byId<HTMLDivElement>("catalog");
  const search = byId<HTMLInputElement>("search");
  const sheetsContainer = byId<HTMLDivElement>("sheets");
  const formatSelect = byId<HTMLSelectElement>("format");
  const customForm = byId<HTMLFormElement>("custom-format");
  const printButton = byId<HTMLButtonElement>("print");
  const status = byId<HTMLParagraphElement>("status");
  const undoButton = byId<HTMLButtonElement>("undo");
  const namesInput = byId<HTMLInputElement>("show-names");
  const scaleInput = byId<HTMLInputElement>("image-scale");
  const offsetXInput = byId<HTMLInputElement>("offset-x");
  const offsetYInput = byId<HTMLInputElement>("offset-y");
  const fileInput = byId<HTMLInputElement>("upload-files");
  const printSheets = byId<HTMLDivElement>("print-sheets");
  let drag: LabelDrag | null = null;
  let suppressClick = false;
  let state: EditorState = {
    format: { ...defaultFormat },
    sheets: [emptySheet(defaultFormat)],
    page: 0,
    selected: 0,
  };
  let chosenId = "25";
  let filter = "favorites";
  let printing = false;
  let uploadSequence = 0;
  const history: EditorState[] = [];
  const printOptions: PrintOptions = { names: false, scale: 100, offsetX: 0, offsetY: 0 };

  // A small, editable example makes the first sheet immediately useful.
  state.sheets[0]!.splice(0, 6, "25", "1", "4", "7", "133", "39");
  state.selected = 6;

  function currentSheet(): Sheet {
    return state.sheets[state.page]!;
  }
  function snapshot(): void {
    history.push(structuredClone(state));
    if (history.length > 30) history.shift();
  }
  function announce(message: string): void {
    status.textContent = message;
  }
  function updateFormatFields(): void {
    formatSelect.value = state.format.id;
    customForm.hidden = state.format.id !== "custom";
    for (const key of [
      "columns",
      "rows",
      "width",
      "height",
      "marginX",
      "marginY",
      "gapX",
      "gapY",
    ] as const) {
      (customForm.elements.namedItem(key) as HTMLInputElement).value = String(state.format[key]);
    }
  }

  function renderCatalog(): void {
    const query = search.value.trim().toLocaleLowerCase("de");
    const source =
      filter === "favorites" && !query
        ? favorites.map((id) => artworks.get(String(id))!)
        : [...artworks.values()].filter(({ id, kind }) =>
            filter === "uploads"
              ? id.startsWith("upload-")
              : filter === "cards"
                ? kind === "card"
                : !id.startsWith("upload-") && kind !== "card",
          );
    const entries = source.filter(
      ({ id, name, caption }) =>
        !query ||
        name.toLocaleLowerCase("de").includes(query) ||
        (caption?.toLocaleLowerCase("de").includes(query) ?? false) ||
        (englishNames.get(id)?.toLowerCase().includes(query) ?? false) ||
        id === query.replace(/^#?0*/, ""),
    );
    const fragment = document.createDocumentFragment();
    for (const artwork of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pokemon${artwork.kind === "card" ? " is-card" : ""}`;
      button.dataset.artwork = artwork.id;
      button.title = `${artwork.name}${artwork.caption ? ` · ${artwork.caption}` : ""} einsetzen`;
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(artwork.id === chosenId));
      const img = document.createElement("img");
      img.src = artwork.image;
      img.alt = "";
      img.loading = "lazy";
      img.width = 80;
      img.height = 80;
      const number = document.createElement("small");
      number.textContent =
        artwork.caption ??
        (artwork.id.startsWith("upload-") ? "EIGENES BILD" : `#${artwork.id.padStart(3, "0")}`);
      const name = document.createElement("span");
      name.textContent = artwork.name;
      button.append(img, number, name);
      fragment.append(button);
    }
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent =
        filter === "uploads" && !query
          ? "Hier ist Platz für deine eigenen Motive. Lade unten PNG-, JPG- oder WebP-Bilder hoch."
          : "Kein Pokémon gefunden. Probiere einen anderen Namen oder eine Nummer von 1 bis 151.";
      fragment.append(empty);
    }
    catalog.replaceChildren(fragment);
    catalog.classList.toggle("is-cards", filter === "cards");
    catalog.scrollTop = 0;
    byId("catalog-count").textContent =
      `${entries.length} ${entries.length === 1 ? "Motiv" : "Motive"}`;
    byId("card-help").hidden = filter !== "cards";
    document
      .querySelectorAll<HTMLButtonElement>("[data-filter]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.filter === filter)),
      );
  }

  function renderSheets(): void {
    cancelDrag();
    sheetsContainer.innerHTML = state.sheets
      .map(
        (sheet, page) =>
          `<div class="sheet-page${page === state.page ? " is-current" : ""}${sheet.every((id) => id === null) ? " is-empty" : ""}" data-page="${page}">${renderSheetSvg(sheet, state.format, artworks, printOptions, page, page === state.page ? state.selected : -1)}</div>`,
      )
      .join("");
    const filled = currentSheet().filter(Boolean).length;
    const printable = state.sheets.filter((sheet) => sheet.some(Boolean)).length;
    const selected = artworks.get(currentSheet()[state.selected] ?? "");
    byId("page-label").textContent = `Bogen ${state.page + 1} / ${state.sheets.length}`;
    byId("filled-count").textContent = `${filled} / ${currentSheet().length} belegt`;
    byId("selected-slot").textContent = `Etikett ${state.selected + 1}`;
    byId("selected-name").textContent = ` · ${selected?.name ?? "frei"}`;
    byId("spec-grid").textContent = `${state.format.columns} × ${state.format.rows}`;
    byId("spec-count").textContent = String(currentSheet().length);
    const number = (value: number) => value.toLocaleString("de", { maximumFractionDigits: 3 });
    byId("sheet-caption").textContent =
      `${number(state.format.width)} × ${number(state.format.height)} mm${state.format.gapX === 0 && state.format.gapY === 0 ? " · ohne Zwischenräume" : ""}`;
    byId("print-label").textContent = printing
      ? "Bilder vorbereiten …"
      : printable > 1
        ? `${printable} Bögen drucken`
        : "Bogen drucken";
    printButton.disabled = printing || printable === 0;
    byId<HTMLButtonElement>("previous-page").disabled = state.page === 0;
    byId<HTMLButtonElement>("next-page").disabled = state.page === state.sheets.length - 1;
    byId<HTMLButtonElement>("clear-slot").disabled = !selected;
    byId<HTMLButtonElement>("clear-sheet").disabled = filled === 0;
    byId<HTMLButtonElement>("fill-sheet").disabled = filled === currentSheet().length;
    byId<HTMLButtonElement>("fill-sheet").title =
      `Freie Etiketten mit ${artworks.get(chosenId)?.name ?? "dem ausgewählten Motiv"} füllen`;
    byId<HTMLButtonElement>("add-page").disabled = state.sheets.length >= 20;
    undoButton.disabled = history.length === 0;
  }

  function focusSlot(): void {
    sheetsContainer
      .querySelector<SVGElement>(`.is-current [data-slot="${state.selected}"]`)
      ?.focus();
  }

  function activateSlot(index: number): void {
    if (currentSheet()[index]) {
      snapshot();
      currentSheet()[index] = null;
      announce(`Etikett ${index + 1} geleert. Mit Rückgängig kannst du das Motiv zurückholen.`);
    }
    state.selected = index;
    renderSheets();
    focusSlot();
  }

  function moveSlot(source: number, target: number): void {
    const next = swapSlots(currentSheet(), source, target);
    if (next === currentSheet()) return;
    const occupied = Boolean(currentSheet()[target]);
    snapshot();
    state.sheets[state.page] = next;
    state.selected = target;
    renderSheets();
    focusSlot();
    announce(
      occupied
        ? `Etiketten ${source + 1} und ${target + 1} getauscht.`
        : `Motiv von Etikett ${source + 1} nach ${target + 1} verschoben.`,
    );
  }

  function cancelDrag(): void {
    const previous = drag;
    drag = null;
    if (previous) {
      suppressClick = true;
      previous.ghost?.remove();
      if (sheetsContainer.hasPointerCapture(previous.pointerId))
        sheetsContainer.releasePointerCapture(previous.pointerId);
    }
    sheetsContainer
      .querySelectorAll(".is-drag-source, .is-drop-target")
      .forEach((element) => element.classList.remove("is-drag-source", "is-drop-target"));
    document.body.classList.remove("is-label-dragging");
  }

  function dropSlot(x: number, y: number): SVGElement | null {
    const slot = document.elementFromPoint(x, y)?.closest<SVGElement>("[data-slot]") ?? null;
    return slot?.closest(".sheet-page.is-current") && sheetsContainer.contains(slot) ? slot : null;
  }

  function preparePrint(): void {
    cancelDrag();
    printSheets.innerHTML = renderPrintSheets(state.sheets, state.format, artworks, printOptions);
  }

  function placeArtwork(id: string): void {
    const artwork = artworks.get(id);
    if (!artwork) return;
    snapshot();
    chosenId = id;
    const slot = state.selected;
    currentSheet()[slot] = id;
    state.selected = nextEmptySlot(currentSheet(), slot);
    renderSheets();
    catalog
      .querySelectorAll<HTMLButtonElement>("[data-artwork]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.artwork === chosenId)),
      );
    announce(
      `${artwork.name} auf Etikett ${slot + 1} gesetzt.${currentSheet().every(Boolean) ? " Der Bogen ist voll. Wähle ein Feld zum Ersetzen oder füge einen Bogen hinzu." : ""}`,
    );
  }

  function setFormat(format: LabelFormat): void {
    const error = formatError(format);
    byId("format-error").textContent = error ?? "";
    if (error) return;
    snapshot();
    state.sheets = reflowSheets(state.sheets, format);
    state.format = format;
    state.page = 0;
    state.selected = 0;
    updateFormatFields();
    renderSheets();
    announce("Format übernommen. Bitte die neue Anordnung vor dem Druck prüfen.");
  }

  catalog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const id = target.closest<HTMLButtonElement>("[data-artwork]")?.dataset.artwork;
    if (id) placeArtwork(id);
  });
  search.addEventListener("input", renderCatalog);
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter!;
      search.value = "";
      renderCatalog();
    }),
  );
  sheetsContainer.addEventListener("click", (event) => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      return;
    }
    const slot = (event.target as Element).closest<SVGElement>("[data-slot]");
    if (!slot) return;
    activateSlot(Number(slot.dataset.slot));
  });
  sheetsContainer.addEventListener("pointerdown", (event) => {
    suppressClick = false;
    if (!event.isPrimary || event.button !== 0) return;
    const slot = (event.target as Element).closest<SVGElement>("[data-slot]");
    if (!slot || !currentSheet()[Number(slot.dataset.slot)]) return;
    drag = {
      pointerId: event.pointerId,
      source: Number(slot.dataset.slot),
      page: state.page,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      ghost: null,
    };
    sheetsContainer.setPointerCapture(event.pointerId);
  });
  sheetsContainer.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8)
      return;
    event.preventDefault();
    if (!drag.dragging) {
      drag.dragging = true;
      const artwork = artworks.get(currentSheet()[drag.source]!);
      if (!artwork) {
        cancelDrag();
        return;
      }
      drag.ghost = document.createElement("img");
      drag.ghost.className = "drag-preview screen-only";
      drag.ghost.src = artwork.image;
      drag.ghost.alt = "";
      document.body.append(drag.ghost);
      document.body.classList.add("is-label-dragging");
      sheetsContainer
        .querySelector(`.is-current [data-slot="${drag.source}"]`)
        ?.classList.add("is-drag-source");
    }
    drag.ghost!.style.left = `${event.clientX}px`;
    drag.ghost!.style.top = `${event.clientY}px`;
    sheetsContainer.querySelector(".is-drop-target")?.classList.remove("is-drop-target");
    const target = dropSlot(event.clientX, event.clientY);
    if (target && Number(target.dataset.slot) !== drag.source)
      target.classList.add("is-drop-target");
  });
  sheetsContainer.addEventListener("pointerup", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const previous = drag;
    const target = dropSlot(event.clientX, event.clientY);
    cancelDrag();
    if (!previous.dragging) {
      // Pointer capture retargets the following click to the container.
      if (target && Number(target.dataset.slot) === previous.source) activateSlot(previous.source);
    } else if (target && previous.page === state.page) {
      moveSlot(previous.source, Number(target.dataset.slot));
    }
  });
  sheetsContainer.addEventListener("pointercancel", cancelDrag);
  sheetsContainer.addEventListener("lostpointercapture", () => {
    if (drag) cancelDrag();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drag) {
      cancelDrag();
      announce("Verschieben abgebrochen.");
    }
  });
  sheetsContainer.addEventListener("keydown", (event) => {
    if (!(event.target as Element).closest("[data-slot]")) return;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -state.format.columns,
      ArrowDown: state.format.columns,
    };
    if (event.key in moves) {
      event.preventDefault();
      const target = Math.max(
        0,
        Math.min(currentSheet().length - 1, state.selected + moves[event.key]!),
      );
      if (event.shiftKey) moveSlot(state.selected, target);
      else {
        state.selected = target;
        renderSheets();
        focusSlot();
      }
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      byId<HTMLButtonElement>("clear-slot").click();
      focusSlot();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateSlot(state.selected);
    }
  });
  byId("clear-slot").addEventListener("click", () => {
    snapshot();
    currentSheet()[state.selected] = null;
    renderSheets();
    announce(`Etikett ${state.selected + 1} geleert. Die Position bleibt frei.`);
  });
  byId("clear-sheet").addEventListener("click", () => {
    snapshot();
    state.sheets[state.page] = emptySheet(state.format);
    state.selected = 0;
    renderSheets();
    announce("Bogen geleert. Mit Rückgängig kannst du ihn wiederherstellen.");
  });
  byId("fill-sheet").addEventListener("click", () => {
    snapshot();
    state.sheets[state.page] = fillEmptySlots(currentSheet(), chosenId);
    renderSheets();
    announce(`Freie Etiketten mit ${artworks.get(chosenId)!.name} gefüllt.`);
  });
  byId("add-page").addEventListener("click", () => {
    if (state.sheets.length >= 20) return;
    snapshot();
    state.sheets.push(emptySheet(state.format));
    state.page = state.sheets.length - 1;
    state.selected = 0;
    renderSheets();
    announce("Neuer Bogen bereit. Ganz leere Bögen werden nicht gedruckt.");
  });
  for (const [id, delta] of [
    ["previous-page", -1],
    ["next-page", 1],
  ] as const) {
    byId(id).addEventListener("click", () => {
      state.page = Math.max(0, Math.min(state.sheets.length - 1, state.page + delta));
      state.selected = 0;
      renderSheets();
    });
  }
  undoButton.addEventListener("click", () => {
    const previous = history.pop();
    if (!previous) return;
    state = previous;
    updateFormatFields();
    renderSheets();
    announce("Letzte Änderung rückgängig gemacht.");
  });
  formatSelect.replaceChildren(
    ...labelFormats.map((format) => new Option(format.name, format.id)),
    new Option("Eigenes A4-Format …", "custom"),
  );
  formatSelect.addEventListener("change", () => {
    customForm.hidden = formatSelect.value !== "custom";
    if (formatSelect.value === "custom") {
      announce("Eigene Maße eingeben und mit „Format anwenden“ übernehmen.");
    } else {
      const format = labelFormats.find(({ id }) => id === formatSelect.value);
      if (format) setFormat({ ...format });
    }
  });
  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(customForm);
    setFormat({
      id: "custom",
      name: "Eigenes A4-Format",
      columns: Number(values.get("columns")),
      rows: Number(values.get("rows")),
      width: Number(values.get("width")),
      height: Number(values.get("height")),
      marginX: Number(values.get("marginX")),
      marginY: Number(values.get("marginY")),
      gapX: Number(values.get("gapX")),
      gapY: Number(values.get("gapY")),
    });
  });
  namesInput.addEventListener("change", () => {
    printOptions.names = namesInput.checked;
    renderSheets();
  });
  scaleInput.addEventListener("input", () => {
    printOptions.scale = Number(scaleInput.value);
    byId("scale-value").textContent = `${printOptions.scale} %`;
    renderSheets();
  });
  for (const [input, key] of [
    [offsetXInput, "offsetX"],
    [offsetYInput, "offsetY"],
  ] as const) {
    input.addEventListener("input", () => {
      if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) return;
      printOptions[key] = input.valueAsNumber;
      renderSheets();
    });
    input.addEventListener("change", () => {
      input.value = String(printOptions[key]);
    });
  }
  byId("upload").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files ?? [])];
    fileInput.value = "";
    let added = 0;
    const rejected: string[] = [];
    for (const file of files) {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 12 * 1024 * 1024
      ) {
        rejected.push(file.name);
        continue;
      }
      try {
        const image = await readImage(file);
        await decodeImage(image);
        const id = `upload-${++uploadSequence}`;
        artworks.set(id, { id, name: file.name.replace(/\.[^.]+$/, "").slice(0, 60), image });
        added++;
      } catch {
        rejected.push(file.name);
      }
    }
    filter = "uploads";
    search.value = "";
    renderCatalog();
    announce(
      `${added} eigene Bilder hinzugefügt.${rejected.length ? ` Nicht geladen: ${rejected.join(", ")}. Erlaubt sind PNG, JPG und WebP bis 12 MB pro Bild.` : " Sie bleiben lokal in diesem Browserfenster."}`,
    );
  });
  printButton.addEventListener("click", async () => {
    if (printing || !state.sheets.some((sheet) => sheet.some(Boolean))) return;
    printing = true;
    renderSheets();
    const ids = new Set(state.sheets.flat().filter((id): id is string => id !== null));
    try {
      await Promise.all([...ids].map((id) => decodeImage(artworks.get(id)!.image)));
      preparePrint();
      // Give inline SVG images a painted frame before opening the print dialog.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      announce("Im Druckdialog: A4, 100 %, einseitig, Kopf- und Fußzeilen aus.");
      window.print();
    } catch {
      announce(
        "Mindestens ein Bild konnte nicht geladen werden. Bitte das betroffene Motiv ersetzen und erneut drucken.",
      );
    } finally {
      printing = false;
      renderSheets();
    }
  });
  window.addEventListener("beforeprint", preparePrint);
  updateFormatFields();
  renderCatalog();
  renderSheets();
  announce(
    "Ein kleiner Beispielbogen zum Start. Du kannst jedes Motiv ersetzen oder den Bogen leeren.",
  );
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Ungültiges Bild."));
    reader.onerror = () => reject(new Error("Bild nicht lesbar."));
    reader.readAsDataURL(file);
  });
}

async function decodeImage(source: string): Promise<void> {
  const image = new Image();
  image.src = source;
  await image.decode();
}

if (typeof document !== "undefined") start();
