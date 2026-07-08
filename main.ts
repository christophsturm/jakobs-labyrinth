export type Difficulty = "easy" | "medium" | "hard";

export type Point = {
  x: number;
  y: number;
};

export type Puzzle = {
  word: string;
  cols: number;
  rows: number;
  difficulty: Difficulty;
  seed: number;
  letters: string[][];
  solutionPath: Point[];
};

type Random = () => number;

type GeneratePuzzleOptions = {
  word: string;
  cols: number;
  rows?: number;
  difficulty: Difficulty;
  seed?: number;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ";
const maxBacktrackingAttempts = 140;
const maxGridSize = 24;

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer",
};

export function normalizeWord(input: string): string {
  return input
    .normalize("NFC")
    .trim()
    .toLocaleUpperCase("de-DE")
    .replace(/[^A-ZÄÖÜ]/g, "");
}

export function makeSeed(input = `${Date.now()}:${Math.random()}`): number {
  let hash = 2166136261;

  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0 || 1;
}

export function generatePuzzle(options: GeneratePuzzleOptions): Puzzle {
  const word = normalizeWord(options.word);
  const rows = options.rows ?? options.cols;
  const { cols, difficulty } = options;

  validatePuzzleInput(word, cols, rows);

  const seed =
    options.seed ??
    makeSeed(`${word}:${cols}:${rows}:${difficulty}:${Date.now()}:${Math.random()}`);
  const rng = createRandom(seed);
  const solutionPath = generatePath(word.length, cols, rows, difficulty, rng);
  const solutionKeys = new Set(solutionPath.map(pointKey));

  const letters = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (solutionKeys.has(`${x},${y}`)) {
        return "";
      }

      return randomFillerLetter(word, difficulty, rng);
    }),
  );

  for (let index = 0; index < word.length; index += 1) {
    const point = solutionPath[index];
    const letter = word[index];

    if (!point || !letter) {
      throw new Error("Der Lösungspfad konnte nicht vollständig erzeugt werden.");
    }

    letters[point.y]![point.x] = letter;
  }

  return {
    word,
    cols,
    rows,
    difficulty,
    seed,
    letters,
    solutionPath,
  };
}

export function renderSvg(puzzle: Puzzle, options: { showSolution: boolean }): string {
  const cell = 48;
  const padding = 3;
  const width = puzzle.cols * cell + padding * 2;
  const height = puzzle.rows * cell + padding * 2;
  const solutionKeys = new Set(puzzle.solutionPath.map(pointKey));
  const cells: string[] = [];

  for (let y = 0; y < puzzle.rows; y += 1) {
    const row = puzzle.letters[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < puzzle.cols; x += 1) {
      const letter = row[x] ?? "";
      const isSolution = solutionKeys.has(`${x},${y}`);
      const originX = padding + x * cell;
      const originY = padding + y * cell;

      cells.push(`
        <g>
          <rect
            x="${originX}"
            y="${originY}"
            width="${cell}"
            height="${cell}"
            rx="4"
            fill="${options.showSolution && isSolution ? "#d9f0e1" : "#fffdf8"}"
            stroke="#1e241f"
            stroke-width="1.25"
          />
          <text
            x="${originX + cell / 2}"
            y="${originY + cell / 2 + 1}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="24"
            font-family="Avenir Next, Segoe UI, Helvetica, sans-serif"
            font-weight="800"
            fill="#171a16"
          >${escapeHtml(letter)}</text>
        </g>
      `);
    }
  }

  const solutionLayer = options.showSolution
    ? `${renderSolutionLine(puzzle.solutionPath, cell, padding)}
       ${renderEndpointMarkers(puzzle.solutionPath, cell, padding)}`
    : "";

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="${width}"
      height="${height}"
      role="img"
      aria-label="Buchstabenlabyrinth für ${escapeHtml(puzzle.word)}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Buchstabenlabyrinth für ${escapeHtml(puzzle.word)}</title>
      <desc>${puzzle.cols} mal ${puzzle.rows} Felder, Schwierigkeit ${escapeHtml(
        difficultyLabels[puzzle.difficulty],
      )}</desc>
      ${cells.join("")}
      ${solutionLayer}
    </svg>
  `;
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function validatePuzzleInput(word: string, cols: number, rows: number): void {
  if (!word) {
    throw new Error("Bitte ein Wort eingeben.");
  }

  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols < 4 ||
    rows < 4 ||
    cols > maxGridSize ||
    rows > maxGridSize
  ) {
    throw new Error(`Das Raster muss zwischen 4 und ${maxGridSize} Feldern groß sein.`);
  }

  if (word.length > cols * rows) {
    throw new Error("Das Wort ist zu lang für dieses Raster.");
  }
}

function createRandom(seed: number): Random {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomFillerLetter(word: string, difficulty: Difficulty, rng: Random): string {
  const distractorChance: Record<Difficulty, number> = {
    easy: 0.07,
    medium: 0.17,
    hard: 0.34,
  };

  if (rng() < distractorChance[difficulty]) {
    const index = Math.floor(rng() * word.length);
    return word[index] ?? alphabet[0] ?? "A";
  }

  const index = Math.floor(rng() * alphabet.length);
  return alphabet[index] ?? "A";
}

function generatePath(
  length: number,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Point[] {
  for (let attempt = 0; attempt < maxBacktrackingAttempts; attempt += 1) {
    const start = pickStart(cols, rows, difficulty, rng);
    const path = buildPathFrom(start, length, cols, rows, difficulty, rng);

    if (path) {
      return path;
    }
  }

  return generateSnakeFallback(length, cols, rows, rng);
}

function pickStart(cols: number, rows: number, difficulty: Difficulty, rng: Random): Point {
  if (difficulty === "easy") {
    return {
      x: Math.floor(rng() * Math.max(1, Math.ceil(cols / 3))),
      y: Math.floor(rng() * Math.max(1, Math.ceil(rows / 3))),
    };
  }

  if (difficulty === "hard") {
    const marginX = Math.max(0, Math.floor(cols / 4));
    const marginY = Math.max(0, Math.floor(rows / 4));

    return {
      x: marginX + Math.floor(rng() * Math.max(1, cols - marginX * 2)),
      y: marginY + Math.floor(rng() * Math.max(1, rows - marginY * 2)),
    };
  }

  return {
    x: Math.floor(rng() * cols),
    y: Math.floor(rng() * rows),
  };
}

function buildPathFrom(
  start: Point,
  length: number,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Point[] | null {
  const path: Point[] = [start];
  const used = new Set<string>([pointKey(start)]);

  function walk(): boolean {
    if (path.length === length) {
      return true;
    }

    const current = path[path.length - 1];

    if (!current) {
      return false;
    }

    const candidates = orderCandidates(
      neighbors(current, cols, rows).filter((point) => !used.has(pointKey(point))),
      path,
      used,
      cols,
      rows,
      difficulty,
      rng,
    );

    for (const candidate of candidates) {
      const remainingAfterCandidate = length - path.length - 1;

      if (
        remainingAfterCandidate > 0 &&
        countReachable(candidate, used, cols, rows) < remainingAfterCandidate + 1
      ) {
        continue;
      }

      used.add(pointKey(candidate));
      path.push(candidate);

      if (walk()) {
        return true;
      }

      path.pop();
      used.delete(pointKey(candidate));
    }

    return false;
  }

  return walk() ? [...path] : null;
}

function orderCandidates(
  candidates: Point[],
  path: Point[],
  used: Set<string>,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Point[] {
  return candidates
    .map((point) => ({
      point,
      score: candidateScore(point, path, used, cols, rows, difficulty) + rng(),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ point }) => point);
}

function candidateScore(
  point: Point,
  path: Point[],
  used: Set<string>,
  cols: number,
  rows: number,
  difficulty: Difficulty,
): number {
  const current = path[path.length - 1];
  const previous = path[path.length - 2];
  const freeNeighbors = neighbors(point, cols, rows).filter(
    (neighbor) => !used.has(pointKey(neighbor)),
  ).length;
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const distanceFromCenter = Math.abs(point.x - centerX) + Math.abs(point.y - centerY);
  const maxCenterDistance = centerX + centerY || 1;
  const centerBias = 1 - distanceFromCenter / maxCenterDistance;

  if (!current || !previous) {
    return freeNeighbors;
  }

  const lastDirection = {
    x: current.x - previous.x,
    y: current.y - previous.y,
  };
  const nextDirection = {
    x: point.x - current.x,
    y: point.y - current.y,
  };
  const continues = lastDirection.x === nextDirection.x && lastDirection.y === nextDirection.y;
  const turns = !continues;

  if (difficulty === "easy") {
    return (continues ? 2.4 : 0) + freeNeighbors * 0.45;
  }

  if (difficulty === "hard") {
    return (turns ? 1.8 : 0) + centerBias * 0.7 + freeNeighbors * 0.2;
  }

  return (turns ? 0.75 : 0.35) + freeNeighbors * 0.35 + centerBias * 0.25;
}

function countReachable(start: Point, used: Set<string>, cols: number, rows: number): number {
  const queue: Point[] = [start];
  const seen = new Set<string>([pointKey(start)]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];

    if (!current) {
      continue;
    }

    for (const next of neighbors(current, cols, rows)) {
      const nextKey = pointKey(next);

      if (used.has(nextKey) || seen.has(nextKey)) {
        continue;
      }

      seen.add(nextKey);
      queue.push(next);
    }
  }

  return seen.size;
}

function generateSnakeFallback(length: number, cols: number, rows: number, rng: Random): Point[] {
  const snake: Point[] = [];

  for (let y = 0; y < rows; y += 1) {
    const leftToRight = y % 2 === 0;

    for (let offset = 0; offset < cols; offset += 1) {
      snake.push({
        x: leftToRight ? offset : cols - 1 - offset,
        y,
      });
    }
  }

  const transformed = transformSnake(snake, cols, rows, rng);
  const startIndex = Math.floor(rng() * (transformed.length - length + 1));
  const segment = transformed.slice(startIndex, startIndex + length);

  return rng() < 0.5 ? segment.reverse() : segment;
}

function transformSnake(snake: Point[], cols: number, rows: number, rng: Random): Point[] {
  const variant = Math.floor(rng() * (cols === rows ? 4 : 3));

  if (variant === 1) {
    return snake.map((point) => ({ x: cols - 1 - point.x, y: point.y }));
  }

  if (variant === 2) {
    return snake.map((point) => ({ x: point.x, y: rows - 1 - point.y }));
  }

  if (variant === 3) {
    return snake.map((point) => ({ x: point.y, y: point.x }));
  }

  return snake;
}

function neighbors(point: Point, cols: number, rows: number): Point[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ].filter(
    (candidate) => candidate.x >= 0 && candidate.x < cols && candidate.y >= 0 && candidate.y < rows,
  );
}

function renderSolutionLine(path: Point[], cell: number, padding: number): string {
  const points = path
    .map((point) => `${padding + point.x * cell + cell / 2},${padding + point.y * cell + cell / 2}`)
    .join(" ");

  return `
    <polyline
      points="${points}"
      fill="none"
      stroke="#0b5f3a"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.58"
    />
  `;
}

function renderEndpointMarkers(path: Point[], cell: number, padding: number): string {
  const start = path[0];
  const end = path[path.length - 1];

  if (!start || !end) {
    return "";
  }

  return `
    ${renderEndpoint(start, "Start", "#f9d64a", cell, padding)}
    ${renderEndpoint(end, "Ziel", "#ef7258", cell, padding)}
  `;
}

function renderEndpoint(
  point: Point,
  label: string,
  fill: string,
  cell: number,
  padding: number,
): string {
  const centerX = padding + point.x * cell + cell / 2;
  const centerY = padding + point.y * cell + cell / 2;

  return `
    <g>
      <circle cx="${centerX}" cy="${centerY}" r="16" fill="${fill}" stroke="#161815" stroke-width="1.4" />
      <text
        x="${centerX}"
        y="${centerY + 1}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="7"
        font-family="Avenir Next, Segoe UI, Helvetica, sans-serif"
        font-weight="900"
        fill="#161815"
      >${escapeHtml(label)}</text>
    </g>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindApp(): void {
  const wordInput = byId<HTMLInputElement>("word");
  const sizeSelect = byId<HTMLSelectElement>("size");
  const difficultySelect = byId<HTMLSelectElement>("difficulty");
  const generateButton = byId<HTMLButtonElement>("generate");
  const toggleSolutionButton = byId<HTMLButtonElement>("toggle-solution");
  const printButton = byId<HTMLButtonElement>("print");
  const worksheet = byId<HTMLDivElement>("worksheet");
  const worksheetMeta = byId<HTMLDivElement>("worksheet-meta");
  const status = byId<HTMLParagraphElement>("status");

  let currentPuzzle: Puzzle | null = null;
  let showSolution = false;

  function renderCurrentPuzzle(): void {
    if (!currentPuzzle) {
      return;
    }

    worksheet.innerHTML = renderSvg(currentPuzzle, { showSolution });
    worksheetMeta.textContent = `Wort: ${currentPuzzle.word} · ${currentPuzzle.cols} × ${currentPuzzle.rows} · ${
      difficultyLabels[currentPuzzle.difficulty]
    }`;
  }

  function regenerate(): void {
    showSolution = false;
    toggleSolutionButton.textContent = "Lösung anzeigen";

    try {
      currentPuzzle = generatePuzzle({
        word: wordInput.value,
        cols: Number(sizeSelect.value),
        difficulty: difficultySelect.value as Difficulty,
      });
      status.textContent = "";
      renderCurrentPuzzle();
    } catch (error) {
      currentPuzzle = null;
      worksheet.textContent = "";
      worksheetMeta.textContent = "";
      status.textContent = error instanceof Error ? error.message : "Fehler beim Erzeugen.";
    }
  }

  generateButton.addEventListener("click", regenerate);
  wordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      regenerate();
    }
  });
  toggleSolutionButton.addEventListener("click", () => {
    if (!currentPuzzle) {
      return;
    }

    showSolution = !showSolution;
    toggleSolutionButton.textContent = showSolution ? "Lösung verstecken" : "Lösung anzeigen";
    renderCurrentPuzzle();
  });
  printButton.addEventListener("click", () => window.print());

  regenerate();
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element as T;
}

if (typeof document !== "undefined") {
  bindApp();
}
