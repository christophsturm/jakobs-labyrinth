export type DicePresetId = "color-shape" | "kniffel" | "double-six" | "custom";

export type DiceColor = {
  id: "red" | "yellow" | "green" | "blue";
  label: string;
  value: string;
};

export type DiceShape = {
  id: "circle" | "triangle" | "square" | "hexagon";
  label: string;
};

export type ColorShapeRoll = {
  color: DiceColor;
  shape: DiceShape;
};

type Random = () => number;

type DicePreset = {
  id: DicePresetId;
  title: string;
  kicker: string;
  count?: number;
  sides?: number;
};

const colors: readonly DiceColor[] = [
  { id: "red", label: "Rot", value: "#df4935" },
  { id: "yellow", label: "Gelb", value: "#f1c83f" },
  { id: "green", label: "Grün", value: "#3d9c64" },
  { id: "blue", label: "Blau", value: "#3478bd" },
];

const shapes: readonly DiceShape[] = [
  { id: "circle", label: "Kreis" },
  { id: "triangle", label: "Dreieck" },
  { id: "square", label: "Quadrat" },
  { id: "hexagon", label: "Sechseck" },
];

const presets: Record<DicePresetId, DicePreset> = {
  "color-shape": {
    id: "color-shape",
    title: "Farbe & Form",
    kicker: "Zwei Zeichen",
  },
  kniffel: {
    id: "kniffel",
    title: "Kniffel",
    kicker: "Fünf Würfel",
    count: 5,
    sides: 6,
  },
  "double-six": {
    id: "double-six",
    title: "Zwei Würfel",
    kicker: "Klassisch",
    count: 2,
    sides: 6,
  },
  custom: {
    id: "custom",
    title: "Eigenes Set",
    kicker: "Nach Maß",
  },
};

const allowedSideCounts = new Set([4, 6, 8, 10, 12, 20]);

export function rollNumericDice(
  count: number,
  sides: number,
  random: Random = Math.random,
): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    throw new RangeError("Die Würfelanzahl muss zwischen 1 und 12 liegen.");
  }

  if (!Number.isInteger(sides) || sides < 2 || sides > 100) {
    throw new RangeError("Die Seitenanzahl muss zwischen 2 und 100 liegen.");
  }

  return Array.from({ length: count }, () => randomIndex(sides, random) + 1);
}

export function rollColorAndShape(random: Random = Math.random): ColorShapeRoll {
  const color = colors[randomIndex(colors.length, random)];
  const shape = shapes[randomIndex(shapes.length, random)];

  if (!color || !shape) {
    throw new Error("Farbe und Form konnten nicht gewürfelt werden.");
  }

  return { color, shape };
}

function randomIndex(length: number, random: Random): number {
  const value = random();

  if (!Number.isFinite(value)) {
    throw new RangeError("Der Zufallswert muss eine endliche Zahl sein.");
  }

  return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
}

function bindDiceTool(): void {
  const presetSelect = byId<HTMLSelectElement>("dice-preset");
  const customFields = byId<HTMLDivElement>("custom-dice-fields");
  const countInput = byId<HTMLInputElement>("dice-count");
  const sidesSelect = byId<HTMLSelectElement>("dice-sides");
  const stage = byId<HTMLElement>("dice-stage");
  const results = byId<HTMLDivElement>("dice-results");
  const announcement = byId<HTMLParagraphElement>("roll-announcement");
  const title = byId<HTMLHeadingElement>("roll-title");
  const kicker = byId<HTMLParagraphElement>("roll-kicker");

  applySettingsFromUrl(presetSelect, countInput, sidesSelect);

  function currentPreset(): DicePreset {
    return presets[parsePresetId(presetSelect.value)];
  }

  function customCount(): number {
    const count = Number(countInput.value);
    const normalized = Number.isInteger(count) ? Math.min(12, Math.max(1, count)) : 1;

    countInput.value = String(normalized);
    return normalized;
  }

  function customSides(): number {
    const sides = Number(sidesSelect.value);
    return allowedSideCounts.has(sides) ? sides : 6;
  }

  function updateControls(): void {
    const preset = currentPreset();

    customFields.hidden = preset.id !== "custom";
    title.textContent = preset.title;
    kicker.textContent = preset.kicker;
  }

  function updateUrl(): void {
    const preset = currentPreset();
    const url = new URL(window.location.href);

    if (preset.id === "color-shape") {
      url.searchParams.delete("preset");
    } else {
      url.searchParams.set("preset", preset.id);
    }

    if (preset.id === "custom") {
      url.searchParams.set("count", String(customCount()));
      url.searchParams.set("sides", String(customSides()));
    } else {
      url.searchParams.delete("count");
      url.searchParams.delete("sides");
    }

    window.history.replaceState(null, "", url.toString());
  }

  function roll(): void {
    const preset = currentPreset();
    let resultHtml: string;
    let resultText: string;
    let diceCount: number;

    if (preset.id === "color-shape") {
      const roll = rollColorAndShape();

      resultHtml = renderColorShapeRoll(roll);
      resultText = `${roll.color.label} und ${roll.shape.label}`;
      diceCount = 2;
    } else {
      const count = preset.id === "custom" ? customCount() : (preset.count ?? 1);
      const sides = preset.id === "custom" ? customSides() : (preset.sides ?? 6);
      const values = rollNumericDice(count, sides);

      resultHtml = renderNumericDice(values, sides);
      resultText = `Gewürfelt: ${values.join(", ")}`;
      diceCount = count;
    }

    results.innerHTML = resultHtml;
    results.classList.toggle("is-many", diceCount >= 4);
    results.classList.remove("is-rolling");
    void results.offsetWidth;
    results.classList.add("is-rolling");
    announcement.textContent = resultText;
  }

  presetSelect.addEventListener("change", () => {
    updateControls();
    updateUrl();
    roll();
  });
  countInput.addEventListener("change", () => {
    updateUrl();
    roll();
  });
  sidesSelect.addEventListener("change", () => {
    updateUrl();
    roll();
  });
  stage.addEventListener("click", roll);
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat || isInteractiveElement(event.target)) {
      return;
    }

    event.preventDefault();
    roll();
  });

  updateControls();
  updateUrl();
  roll();
}

function applySettingsFromUrl(
  presetSelect: HTMLSelectElement,
  countInput: HTMLInputElement,
  sidesSelect: HTMLSelectElement,
): void {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get("preset");
  const count = Number(params.get("count"));
  const sides = Number(params.get("sides"));

  if (preset && isPresetId(preset)) {
    presetSelect.value = preset;
  }

  if (Number.isInteger(count) && count >= 1 && count <= 12) {
    countInput.value = String(count);
  }

  if (allowedSideCounts.has(sides)) {
    sidesSelect.value = String(sides);
  }
}

function renderColorShapeRoll(roll: ColorShapeRoll): string {
  return `
    <div class="die-result">
      <div class="die color-die" style="--die-color: ${roll.color.value}"></div>
      <span class="result-name">${roll.color.label}<small>Farbe</small></span>
    </div>
    <div class="die-result">
      <div class="die shape-die">${renderShapeSvg(roll.shape.id)}</div>
      <span class="result-name">${roll.shape.label}<small>Form</small></span>
    </div>
  `;
}

function renderShapeSvg(shape: DiceShape["id"]): string {
  const content: Record<DiceShape["id"], string> = {
    circle: '<circle cx="50" cy="50" r="35" fill="currentColor" />',
    triangle: '<path d="M50 12 91 84H9Z" fill="currentColor" />',
    square: '<rect x="17" y="17" width="66" height="66" rx="5" fill="currentColor" />',
    hexagon: '<path d="M50 9 87 29v42L50 91 13 71V29Z" fill="currentColor" />',
  };

  return `<svg viewBox="0 0 100 100" aria-hidden="true">${content[shape]}</svg>`;
}

function renderNumericDice(values: readonly number[], sides: number): string {
  return values
    .map(
      (value) => `
        <div class="die-result">
          <div class="die number-die">
            ${sides === 6 ? renderPips(value) : `<span class="number-face">${value}<small>W${sides}</small></span>`}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderPips(value: number): string {
  const visibleSlots: Record<number, readonly number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  const visible = new Set(visibleSlots[value] ?? []);

  return `<span class="pip-grid" aria-hidden="true">${Array.from(
    { length: 9 },
    (_, index) => `<span class="pip${visible.has(index + 1) ? " is-visible" : ""}"></span>`,
  ).join("")}</span>`;
}

function parsePresetId(value: string): DicePresetId {
  return isPresetId(value) ? value : "color-shape";
}

function isPresetId(value: string): value is DicePresetId {
  return (
    value === "color-shape" || value === "kniffel" || value === "double-six" || value === "custom"
  );
}

function isInteractiveElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("button, input, select, textarea, a") || target.isContentEditable)
  );
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element as T;
}

if (typeof document !== "undefined") {
  bindDiceTool();
}
