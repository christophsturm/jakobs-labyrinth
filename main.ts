export type Difficulty = "easy" | "medium" | "hard";

export type PuzzleKind = "maze" | "wordSearch";

export type MazeLetterAmount = "few" | "normal" | "many";

export type Point = {
  x: number;
  y: number;
};

export type BasePuzzle = {
  kind: PuzzleKind;
  word: string;
  cols: number;
  rows: number;
  difficulty: Difficulty;
  seed: number;
  letters: string[][];
  solutionPath: Point[];
  wordLetterPoints: Point[];
};

export type WordSearchPuzzle = BasePuzzle & {
  kind: "wordSearch";
};

export type WallSet = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type Direction = "top" | "right" | "bottom" | "left";

export type MazeOpening = {
  point: Point;
  side: Direction;
};

export type MazeCell = {
  x: number;
  y: number;
  walls: WallSet;
};

export type MazePuzzle = BasePuzzle & {
  kind: "maze";
  mazeLetterAmount: MazeLetterAmount;
  maze: MazeCell[][];
  start: Point;
  end: Point;
  entrance: MazeOpening;
  exit: MazeOpening;
};

export type Puzzle = WordSearchPuzzle | MazePuzzle;

type Random = () => number;

type GeneratePuzzleOptions = {
  kind?: PuzzleKind;
  word: string;
  cols: number;
  rows?: number;
  difficulty: Difficulty;
  mazeLetterAmount?: MazeLetterAmount;
  seed?: number;
};

type DirectionVector = {
  direction: Direction;
  opposite: Direction;
  dx: number;
  dy: number;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ";
const maxBacktrackingAttempts = 140;
const maxMazeAttempts = 80;
const maxGridSize = 24;

const directions: DirectionVector[] = [
  { direction: "top", opposite: "bottom", dx: 0, dy: -1 },
  { direction: "right", opposite: "left", dx: 1, dy: 0 },
  { direction: "bottom", opposite: "top", dx: 0, dy: 1 },
  { direction: "left", opposite: "right", dx: -1, dy: 0 },
];

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer",
};

const puzzleKindLabels: Record<PuzzleKind, string> = {
  maze: "Buchstabenlabyrinth",
  wordSearch: "Wortsuchbild",
};

const mazeLetterAmountLabels: Record<MazeLetterAmount, string> = {
  few: "Wenig",
  normal: "Mehr",
  many: "Viele",
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
  if (options.kind === "wordSearch") {
    return generateWordSearchPuzzle(options);
  }

  return generateMazePuzzle({ ...options, kind: "maze" });
}

export function generateWordSearchPuzzle(options: GeneratePuzzleOptions): WordSearchPuzzle {
  const word = normalizeWord(options.word);
  const rows = options.rows ?? options.cols;
  const { cols, difficulty } = options;

  validatePuzzleInput(word, cols, rows);

  const seed = resolveSeed(options, "wordSearch", word, cols, rows, difficulty);
  const rng = createRandom(seed);
  const solutionPath = generateWordSearchPath(word.length, cols, rows, difficulty, rng);
  const wordLetterPoints = [...solutionPath];
  const letters = fillGrid(word, cols, rows, difficulty, rng);

  placeWordLetters(letters, word, wordLetterPoints);

  return {
    kind: "wordSearch",
    word,
    cols,
    rows,
    difficulty,
    seed,
    letters,
    solutionPath,
    wordLetterPoints,
  };
}

export function generateMazePuzzle(options: GeneratePuzzleOptions): MazePuzzle {
  const word = normalizeWord(options.word);
  const rows = options.rows ?? options.cols;
  const { cols, difficulty } = options;
  const mazeLetterAmount = options.mazeLetterAmount ?? "normal";

  validatePuzzleInput(word, cols, rows);
  validateMazeLetterAmount(mazeLetterAmount);

  const seed = resolveSeed(options, "maze", word, cols, rows, difficulty, mazeLetterAmount);
  const rng = createRandom(seed);
  let maze = createMazeGrid(cols, rows);
  let solutionPath: Point[] = [];
  let entranceSide: Direction = "left";
  let exitSide: Direction = "right";
  const sidePairs = orderedMazeSidePairs(difficulty, rng);

  for (let attempt = 0; attempt < maxMazeAttempts; attempt += 1) {
    const attemptMaze = createMazeGrid(cols, rows);
    carveMaze(attemptMaze, difficulty, rng);

    for (const [startSide, endSide] of sidePairs) {
      const candidate = findLongestMazePathBetweenSides(attemptMaze, startSide, endSide);

      if (candidate.length > solutionPath.length) {
        maze = attemptMaze;
        solutionPath = candidate;
        entranceSide = startSide;
        exitSide = endSide;
      }
    }

    if (solutionPath.length >= word.length) {
      break;
    }
  }

  if (solutionPath.length < word.length) {
    maze = createSnakeMaze(cols, rows);
    solutionPath = createSnakeSequence(cols, rows);
    const start = solutionPath[0];
    const end = solutionPath[solutionPath.length - 1];

    if (start && end) {
      entranceSide = boundarySideForPoint(start, cols, rows, "left");
      exitSide = boundarySideForPoint(end, cols, rows, "right");
    }
  }

  if (solutionPath.length < word.length) {
    throw new Error("Das Wort ist zu lang für dieses Labyrinth.");
  }

  const wordLetterPoints = selectWordLetterPoints(solutionPath, word.length);
  const letters = createEmptyGrid(cols, rows);

  placeWordLetters(letters, word, wordLetterPoints);
  placeMazeDistractorLetters(
    letters,
    word,
    solutionPath,
    wordLetterPoints,
    difficulty,
    mazeLetterAmount,
    rng,
  );

  const start = solutionPath[0];
  const end = solutionPath[solutionPath.length - 1];

  if (!start || !end) {
    throw new Error("Das Labyrinth konnte nicht erzeugt werden.");
  }

  const entrance = { point: start, side: entranceSide };
  const exit = { point: end, side: exitSide };

  openBoundaryWall(maze, entrance);
  openBoundaryWall(maze, exit);

  return {
    kind: "maze",
    mazeLetterAmount,
    word,
    cols,
    rows,
    difficulty,
    seed,
    letters,
    solutionPath,
    wordLetterPoints,
    maze,
    start,
    end,
    entrance,
    exit,
  };
}

export function renderSvg(puzzle: Puzzle, options: { showSolution: boolean }): string {
  if (puzzle.kind === "maze") {
    return renderMazeSvg(puzzle, options);
  }

  return renderWordSearchSvg(puzzle, options);
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function pathSpellsWord(puzzle: Puzzle): string {
  return puzzle.wordLetterPoints.map((point) => puzzle.letters[point.y]?.[point.x] ?? "").join("");
}

function resolveSeed(
  options: GeneratePuzzleOptions,
  kind: PuzzleKind,
  word: string,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  mazeLetterAmount?: MazeLetterAmount,
): number {
  return (
    options.seed ??
    makeSeed(
      `${kind}:${word}:${cols}:${rows}:${difficulty}:${mazeLetterAmount ?? "n/a"}:${Date.now()}:${Math.random()}`,
    )
  );
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

function validateMazeLetterAmount(value: string): asserts value is MazeLetterAmount {
  if (value !== "few" && value !== "normal" && value !== "many") {
    throw new Error("Ungültige Buchstabenmenge für das Labyrinth.");
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

function shuffle<T>(values: T[], rng: Random): T[] {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    const replacement = copy[swapIndex];

    if (current === undefined || replacement === undefined) {
      continue;
    }

    copy[index] = replacement;
    copy[swapIndex] = current;
  }

  return copy;
}

function fillGrid(
  word: string,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => randomFillerLetter(word, difficulty, rng)),
  );
}

function createEmptyGrid(cols: number, rows: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

function placeWordLetters(letters: string[][], word: string, points: Point[]): void {
  for (let index = 0; index < word.length; index += 1) {
    const point = points[index];
    const letter = word[index];

    if (!point || !letter) {
      throw new Error("Der Lösungspfad konnte nicht vollständig beschriftet werden.");
    }

    letters[point.y]![point.x] = letter;
  }
}

function placeMazeDistractorLetters(
  letters: string[][],
  word: string,
  solutionPath: Point[],
  wordLetterPoints: Point[],
  difficulty: Difficulty,
  mazeLetterAmount: MazeLetterAmount,
  rng: Random,
): void {
  const distractorMultipliers: Record<MazeLetterAmount, Record<Difficulty, number>> = {
    few: {
      easy: 0,
      medium: 0.45,
      hard: 0.9,
    },
    normal: {
      easy: 0.5,
      medium: 1,
      hard: 1.5,
    },
    many: {
      easy: 1,
      medium: 1.75,
      hard: 2.5,
    },
  };
  const reserved = new Set(solutionPath.map(pointKey));
  const wordKeys = new Set(wordLetterPoints.map(pointKey));
  const candidates: Point[] = [];

  for (let y = 0; y < letters.length; y += 1) {
    const row = letters[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      const point = { x, y };
      const key = pointKey(point);

      if (!reserved.has(key) && !wordKeys.has(key)) {
        candidates.push(point);
      }
    }
  }

  const count = Math.min(
    Math.ceil(word.length * distractorMultipliers[mazeLetterAmount][difficulty]),
    candidates.length,
  );
  const selected = selectDistributedPoints(candidates, count, wordLetterPoints, rng);

  for (const point of selected) {
    letters[point.y]![point.x] = randomFillerLetter(word, difficulty, rng);
  }
}

function selectDistributedPoints(
  candidates: Point[],
  count: number,
  anchors: Point[],
  rng: Random,
): Point[] {
  const available = [...candidates];
  const placed = [...anchors];
  const selected: Point[] = [];

  while (selected.length < count && available.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < available.length; index += 1) {
      const point = available[index];

      if (!point) {
        continue;
      }

      const nearestDistance =
        placed.length > 0 ? Math.min(...placed.map((anchor) => squaredDistance(point, anchor))) : 0;
      const score = nearestDistance + rng() * 0.35;

      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    const [point] = available.splice(bestIndex, 1);

    if (!point) {
      continue;
    }

    selected.push(point);
    placed.push(point);
  }

  return selected;
}

function squaredDistance(first: Point, second: Point): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;

  return dx * dx + dy * dy;
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

function generateWordSearchPath(
  length: number,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Point[] {
  for (let attempt = 0; attempt < maxBacktrackingAttempts; attempt += 1) {
    const start = pickWordSearchStart(cols, rows, difficulty, rng);
    const path = buildWordSearchPathFrom(start, length, cols, rows, difficulty, rng);

    if (path) {
      return path;
    }
  }

  return generateSnakePathFallback(length, cols, rows, rng);
}

function pickWordSearchStart(
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Point {
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

function buildWordSearchPathFrom(
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

    const candidates = orderWordSearchCandidates(
      gridNeighbors(current, cols, rows).filter((point) => !used.has(pointKey(point))),
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
        countReachableGridCells(candidate, used, cols, rows) < remainingAfterCandidate + 1
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

function orderWordSearchCandidates(
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
      score: wordSearchCandidateScore(point, path, used, cols, rows, difficulty) + rng(),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ point }) => point);
}

function wordSearchCandidateScore(
  point: Point,
  path: Point[],
  used: Set<string>,
  cols: number,
  rows: number,
  difficulty: Difficulty,
): number {
  const current = path[path.length - 1];
  const previous = path[path.length - 2];
  const freeNeighbors = gridNeighbors(point, cols, rows).filter(
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

function countReachableGridCells(
  start: Point,
  used: Set<string>,
  cols: number,
  rows: number,
): number {
  const queue: Point[] = [start];
  const seen = new Set<string>([pointKey(start)]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];

    if (!current) {
      continue;
    }

    for (const next of gridNeighbors(current, cols, rows)) {
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

function generateSnakePathFallback(
  length: number,
  cols: number,
  rows: number,
  rng: Random,
): Point[] {
  const snake = createSnakeSequence(cols, rows);
  const transformed = transformSnake(snake, cols, rows, rng);
  const startIndex = Math.floor(rng() * (transformed.length - length + 1));
  const segment = transformed.slice(startIndex, startIndex + length);

  return rng() < 0.5 ? segment.reverse() : segment;
}

function createMazeGrid(cols: number, rows: number): MazeCell[][] {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    })),
  );
}

function orderedMazeSidePairs(difficulty: Difficulty, rng: Random): Array<[Direction, Direction]> {
  const pairs: Array<[Direction, Direction]> = [
    ["left", "right"],
    ["top", "bottom"],
    ["right", "left"],
    ["bottom", "top"],
  ];

  if (difficulty === "easy") {
    return pairs;
  }

  return shuffle(pairs, rng);
}

function carveMaze(maze: MazeCell[][], difficulty: Difficulty, rng: Random): void {
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;
  const start: Point = {
    x: Math.floor(rng() * cols),
    y: Math.floor(rng() * rows),
  };
  const visited = new Set<string>([pointKey(start)]);
  const stack: Array<{ point: Point; previousDirection: Direction | null }> = [
    { point: start, previousDirection: null },
  ];

  while (stack.length > 0) {
    const currentFrame = stack[stack.length - 1];

    if (!currentFrame) {
      break;
    }

    const candidates = mazeNeighborDirections(currentFrame.point, cols, rows).filter(
      ({ point }) => !visited.has(pointKey(point)),
    );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = orderMazeCandidates(
      candidates,
      currentFrame.previousDirection,
      cols,
      rows,
      difficulty,
      rng,
    )[0];

    if (!next) {
      stack.pop();
      continue;
    }

    carveWall(maze, currentFrame.point, next.point, next.vector);
    visited.add(pointKey(next.point));
    stack.push({
      point: next.point,
      previousDirection: next.vector.direction,
    });
  }
}

function orderMazeCandidates(
  candidates: Array<{ point: Point; vector: DirectionVector }>,
  previousDirection: Direction | null,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  rng: Random,
): Array<{ point: Point; vector: DirectionVector }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score:
        mazeCandidateScore(
          candidate.point,
          candidate.vector.direction,
          previousDirection,
          cols,
          rows,
          difficulty,
        ) + rng(),
    }))
    .sort((a, b) => b.score - a.score);
}

function mazeCandidateScore(
  point: Point,
  direction: Direction,
  previousDirection: Direction | null,
  cols: number,
  rows: number,
  difficulty: Difficulty,
): number {
  const continues = previousDirection === direction;
  const turns = previousDirection !== null && !continues;
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const distanceFromCenter = Math.abs(point.x - centerX) + Math.abs(point.y - centerY);
  const maxCenterDistance = centerX + centerY || 1;
  const centerBias = 1 - distanceFromCenter / maxCenterDistance;

  if (difficulty === "easy") {
    return (continues ? 1.8 : 0) + (1 - centerBias) * 0.15;
  }

  if (difficulty === "hard") {
    return (turns ? 1.4 : 0) + centerBias * 0.65;
  }

  return (turns ? 0.55 : 0.45) + centerBias * 0.25;
}

function mazeNeighborDirections(
  point: Point,
  cols: number,
  rows: number,
): Array<{ point: Point; vector: DirectionVector }> {
  return directions
    .map((vector) => ({
      vector,
      point: {
        x: point.x + vector.dx,
        y: point.y + vector.dy,
      },
    }))
    .filter(
      ({ point: candidate }) =>
        candidate.x >= 0 && candidate.x < cols && candidate.y >= 0 && candidate.y < rows,
    );
}

function carveWall(maze: MazeCell[][], current: Point, next: Point, vector: DirectionVector): void {
  const currentCell = maze[current.y]?.[current.x];
  const nextCell = maze[next.y]?.[next.x];

  if (!currentCell || !nextCell) {
    throw new Error("Das Labyrinth enthält eine ungültige Zelle.");
  }

  currentCell.walls[vector.direction] = false;
  nextCell.walls[vector.opposite] = false;
}

function createSnakeMaze(cols: number, rows: number): MazeCell[][] {
  const maze = createMazeGrid(cols, rows);
  const snake = createSnakeSequence(cols, rows);

  for (let index = 0; index < snake.length - 1; index += 1) {
    const current = snake[index];
    const next = snake[index + 1];

    if (!current || !next) {
      continue;
    }

    const vector = directionBetween(current, next);
    carveWall(maze, current, next, vector);
  }

  return maze;
}

function findLongestMazePathBetweenSides(
  maze: MazeCell[][],
  startSide: Direction,
  endSide: Direction,
): Point[] {
  const starts = boundaryCells(maze, startSide);
  const ends = boundaryCells(maze, endSide);
  let bestPath: Point[] = [];

  for (const start of starts) {
    const traversal = traverseMazeFrom(start, maze);

    for (const end of ends) {
      const distance = traversal.distances.get(pointKey(end));

      if (distance === undefined || distance + 1 <= bestPath.length) {
        continue;
      }

      bestPath = reconstructPath(end, traversal.parents);
    }
  }

  return bestPath;
}

function boundaryCells(maze: MazeCell[][], side: Direction): Point[] {
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;

  if (cols === 0 || rows === 0) {
    return [];
  }

  if (side === "left") {
    return Array.from({ length: rows }, (_, y) => ({ x: 0, y }));
  }

  if (side === "right") {
    return Array.from({ length: rows }, (_, y) => ({ x: cols - 1, y }));
  }

  if (side === "top") {
    return Array.from({ length: cols }, (_, x) => ({ x, y: 0 }));
  }

  return Array.from({ length: cols }, (_, x) => ({ x, y: rows - 1 }));
}

function traverseMazeFrom(
  start: Point,
  maze: MazeCell[][],
): { parents: Map<string, string>; distances: Map<string, number> } {
  const queue: Point[] = [start];
  const parents = new Map<string, string>();
  const distances = new Map<string, number>([[pointKey(start), 0]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];

    if (!current) {
      continue;
    }

    const currentDistance = distances.get(pointKey(current)) ?? 0;

    for (const next of openMazeNeighbors(current, maze)) {
      const nextKey = pointKey(next);

      if (distances.has(nextKey)) {
        continue;
      }

      parents.set(nextKey, pointKey(current));
      distances.set(nextKey, currentDistance + 1);
      queue.push(next);
    }
  }

  return { parents, distances };
}

function openBoundaryWall(maze: MazeCell[][], opening: MazeOpening): void {
  const cell = maze[opening.point.y]?.[opening.point.x];

  if (!cell) {
    throw new Error("Der Labyrinth-Eingang liegt außerhalb des Rasters.");
  }

  cell.walls[opening.side] = false;
}

function boundarySideForPoint(
  point: Point,
  cols: number,
  rows: number,
  preferred: Direction,
): Direction {
  if (preferred === "left" && point.x === 0) {
    return "left";
  }

  if (preferred === "right" && point.x === cols - 1) {
    return "right";
  }

  if (preferred === "top" && point.y === 0) {
    return "top";
  }

  if (preferred === "bottom" && point.y === rows - 1) {
    return "bottom";
  }

  if (point.x === 0) {
    return "left";
  }

  if (point.x === cols - 1) {
    return "right";
  }

  if (point.y === 0) {
    return "top";
  }

  if (point.y === rows - 1) {
    return "bottom";
  }

  throw new Error("Der Labyrinth-Eingang muss am Rand liegen.");
}

function createSnakeSequence(cols: number, rows: number): Point[] {
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

  return snake;
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

function directionBetween(current: Point, next: Point): DirectionVector {
  const dx = next.x - current.x;
  const dy = next.y - current.y;
  const vector = directions.find((item) => item.dx === dx && item.dy === dy);

  if (!vector) {
    throw new Error("Labyrinth-Zellen sind nicht benachbart.");
  }

  return vector;
}

function reconstructPath(end: Point, parents: Map<string, string>): Point[] {
  const path: Point[] = [end];
  let currentKey = pointKey(end);

  while (parents.has(currentKey)) {
    const parentKey = parents.get(currentKey);

    if (!parentKey) {
      break;
    }

    const parent = pointFromKey(parentKey);
    path.push(parent);
    currentKey = parentKey;
  }

  return path.reverse();
}

function openMazeNeighbors(point: Point, maze: MazeCell[][]): Point[] {
  const cell = maze[point.y]?.[point.x];

  if (!cell) {
    return [];
  }

  return directions
    .filter((vector) => !cell.walls[vector.direction])
    .map((vector) => ({
      x: point.x + vector.dx,
      y: point.y + vector.dy,
    }))
    .filter((candidate) => Boolean(maze[candidate.y]?.[candidate.x]));
}

function selectWordLetterPoints(path: Point[], wordLength: number): Point[] {
  if (wordLength > path.length) {
    throw new Error("Das Wort passt nicht auf den Lösungspfad.");
  }

  if (wordLength === 1) {
    const middle = path[Math.floor(path.length / 2)];

    if (!middle) {
      throw new Error("Der Lösungspfad ist leer.");
    }

    return [middle];
  }

  return Array.from({ length: wordLength }, (_, index) => {
    const pathIndex = Math.round((index * (path.length - 1)) / (wordLength - 1));
    const point = path[pathIndex];

    if (!point) {
      throw new Error("Der Lösungspfad konnte nicht beschriftet werden.");
    }

    return point;
  });
}

function gridNeighbors(point: Point, cols: number, rows: number): Point[] {
  return directions
    .map((vector) => ({
      x: point.x + vector.dx,
      y: point.y + vector.dy,
    }))
    .filter(
      (candidate) =>
        candidate.x >= 0 && candidate.x < cols && candidate.y >= 0 && candidate.y < rows,
    );
}

function renderWordSearchSvg(puzzle: WordSearchPuzzle, options: { showSolution: boolean }): string {
  const cell = 48;
  const padding = 3;
  const width = puzzle.cols * cell + padding * 2;
  const height = puzzle.rows * cell + padding * 2;
  const wordKeys = new Set(puzzle.wordLetterPoints.map(pointKey));
  const cells: string[] = [];

  for (let y = 0; y < puzzle.rows; y += 1) {
    const row = puzzle.letters[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < puzzle.cols; x += 1) {
      const letter = row[x] ?? "";
      const isWordLetter = wordKeys.has(`${x},${y}`);
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
            fill="${options.showSolution && isWordLetter ? "#d9f0e1" : "#fffdf8"}"
            stroke="#1e241f"
            stroke-width="1.25"
          />
          ${renderLetter(letter, originX + cell / 2, originY + cell / 2 + 1, 24)}
        </g>
      `);
    }
  }

  const solutionLayer = options.showSolution
    ? `${renderCenteredPolyline(puzzle.solutionPath, cell, padding, "#0b5f3a", 7, 0.58)}
       ${renderEndpointMarkers(puzzle.solutionPath, cell, padding)}`
    : "";

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="${width}"
      height="${height}"
      role="img"
      aria-label="${puzzleKindLabels.wordSearch} für ${escapeHtml(puzzle.word)}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>${puzzleKindLabels.wordSearch} für ${escapeHtml(puzzle.word)}</title>
      <desc>${puzzle.cols} mal ${puzzle.rows} Felder, Schwierigkeit ${escapeHtml(
        difficultyLabels[puzzle.difficulty],
      )}</desc>
      ${cells.join("")}
      ${solutionLayer}
    </svg>
  `;
}

function renderMazeSvg(puzzle: MazePuzzle, options: { showSolution: boolean }): string {
  const cell = 50;
  const padding = 64;
  const width = puzzle.cols * cell + padding * 2;
  const height = puzzle.rows * cell + padding * 2;
  const wordKeys = new Set(puzzle.wordLetterPoints.map(pointKey));
  const cells: string[] = [];

  for (let y = 0; y < puzzle.rows; y += 1) {
    const row = puzzle.letters[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < puzzle.cols; x += 1) {
      const letter = row[x] ?? "";
      const centerX = padding + x * cell + cell / 2;
      const centerY = padding + y * cell + cell / 2;
      const isWordLetter = wordKeys.has(`${x},${y}`);

      if (!letter && !(options.showSolution && isWordLetter)) {
        continue;
      }

      cells.push(`
        <g>
          ${
            options.showSolution && isWordLetter
              ? `<rect
                  x="${padding + x * cell + 8}"
                  y="${padding + y * cell + 8}"
                  width="${cell - 16}"
                  height="${cell - 16}"
                  rx="5"
                  fill="#fff0a8"
                />`
              : ""
          }
          ${letter ? renderLetter(letter, centerX, centerY + 1, 22) : ""}
        </g>
      `);
    }
  }

  const solutionLayer = options.showSolution
    ? renderCenteredPolyline(puzzle.solutionPath, cell, padding, "#0b5f3a", 12, 0.28)
    : "";

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="${width}"
      height="${height}"
      role="img"
      aria-label="${puzzleKindLabels.maze}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>${puzzleKindLabels.maze}</title>
      <desc>Ein Labyrinth mit Mauern, ${puzzle.cols} mal ${puzzle.rows} Felder, Schwierigkeit ${escapeHtml(
        difficultyLabels[puzzle.difficulty],
      )}</desc>
      ${solutionLayer}
      ${cells.join("")}
      ${renderMazeOpenings(puzzle, cell, padding)}
      ${renderMazeWalls(puzzle.maze, cell, padding)}
    </svg>
  `;
}

function renderLetter(letter: string, x: number, y: number, fontSize: number): string {
  return `
    <text
      x="${x}"
      y="${y}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="${fontSize}"
      font-family="Avenir Next, Segoe UI, Helvetica, sans-serif"
      font-weight="800"
      fill="#171a16"
    >${escapeHtml(letter)}</text>
  `;
}

function renderCenteredPolyline(
  path: Point[],
  cell: number,
  padding: number,
  stroke: string,
  strokeWidth: number,
  opacity: number,
): string {
  const points = path
    .map((point) => `${padding + point.x * cell + cell / 2},${padding + point.y * cell + cell / 2}`)
    .join(" ");

  return `
    <polyline
      points="${points}"
      fill="none"
      stroke="${stroke}"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="${opacity}"
    />
  `;
}

function renderMazeWalls(maze: MazeCell[][], cell: number, padding: number): string {
  const segments = new Set<string>();
  const lines: string[] = [];

  for (const row of maze) {
    for (const mazeCell of row) {
      const x = padding + mazeCell.x * cell;
      const y = padding + mazeCell.y * cell;

      addWallLine(segments, lines, mazeCell.walls.top, x, y, x + cell, y);
      addWallLine(segments, lines, mazeCell.walls.right, x + cell, y, x + cell, y + cell);
      addWallLine(segments, lines, mazeCell.walls.bottom, x, y + cell, x + cell, y + cell);
      addWallLine(segments, lines, mazeCell.walls.left, x, y, x, y + cell);
    }
  }

  return `<g stroke="#171a16" stroke-width="3.2" stroke-linecap="square">${lines.join("")}</g>`;
}

function addWallLine(
  segments: Set<string>,
  lines: string[],
  shouldDraw: boolean,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  if (!shouldDraw) {
    return;
  }

  const key = `${x1},${y1},${x2},${y2}`;
  const reversedKey = `${x2},${y2},${x1},${y1}`;

  if (segments.has(key) || segments.has(reversedKey)) {
    return;
  }

  segments.add(key);
  lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
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

function renderMazeOpenings(puzzle: MazePuzzle, cell: number, padding: number): string {
  return `
    ${renderOpeningLabel(puzzle.entrance, "Eingang", "#f9d64a", cell, padding)}
    ${renderOpeningLabel(puzzle.exit, "Ausgang", "#ef7258", cell, padding)}
  `;
}

function renderOpeningLabel(
  opening: MazeOpening,
  label: string,
  fill: string,
  cell: number,
  padding: number,
): string {
  const centerX = padding + opening.point.x * cell + cell / 2;
  const centerY = padding + opening.point.y * cell + cell / 2;
  const labelWidth = 52;
  const labelHeight = 18;
  const offset = 28;
  const position = openingLabelPosition(
    opening.side,
    centerX,
    centerY,
    labelWidth,
    labelHeight,
    offset,
  );
  const arrow = openingArrow(opening, centerX, centerY, cell, padding);

  return `
    <g>
      ${arrow}
      <rect
        x="${position.x}"
        y="${position.y}"
        width="${labelWidth}"
        height="${labelHeight}"
        rx="4"
        fill="${fill}"
        stroke="#171a16"
        stroke-width="1"
      />
      <text
        x="${position.x + labelWidth / 2}"
        y="${position.y + labelHeight / 2 + 0.5}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="8"
        font-family="Avenir Next, Segoe UI, Helvetica, sans-serif"
        font-weight="900"
        fill="#171a16"
      >${escapeHtml(label)}</text>
    </g>
  `;
}

function openingLabelPosition(
  side: Direction,
  centerX: number,
  centerY: number,
  labelWidth: number,
  labelHeight: number,
  offset: number,
): Point {
  if (side === "left") {
    return { x: centerX - labelWidth - offset, y: centerY - labelHeight / 2 };
  }

  if (side === "right") {
    return { x: centerX + offset, y: centerY - labelHeight / 2 };
  }

  if (side === "top") {
    return { x: centerX - labelWidth / 2, y: centerY - labelHeight - offset };
  }

  return { x: centerX - labelWidth / 2, y: centerY + offset };
}

function openingArrow(
  opening: MazeOpening,
  centerX: number,
  centerY: number,
  cell: number,
  padding: number,
): string {
  const tipDistance = 1;
  const baseDistance = 14;
  const half = 5;

  if (opening.side === "left") {
    const wallX = padding + opening.point.x * cell;
    return `<polygon points="${wallX - baseDistance},${centerY - half} ${wallX - tipDistance},${centerY} ${wallX - baseDistance},${centerY + half}" fill="#171a16" />`;
  }

  if (opening.side === "right") {
    const wallX = padding + (opening.point.x + 1) * cell;
    return `<polygon points="${wallX + baseDistance},${centerY - half} ${wallX + tipDistance},${centerY} ${wallX + baseDistance},${centerY + half}" fill="#171a16" />`;
  }

  if (opening.side === "top") {
    const wallY = padding + opening.point.y * cell;
    return `<polygon points="${centerX - half},${wallY - baseDistance} ${centerX},${wallY - tipDistance} ${centerX + half},${wallY - baseDistance}" fill="#171a16" />`;
  }

  const wallY = padding + (opening.point.y + 1) * cell;
  return `<polygon points="${centerX - half},${wallY + baseDistance} ${centerX},${wallY + tipDistance} ${centerX + half},${wallY + baseDistance}" fill="#171a16" />`;
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

function pointFromKey(key: string): Point {
  const [xRaw, yRaw] = key.split(",");
  const x = Number(xRaw);
  const y = Number(yRaw);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error("Ungültiger Punkt im Lösungspfad.");
  }

  return { x, y };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bindApp(): void {
  const kindSelect = byId<HTMLSelectElement>("kind");
  const wordInput = byId<HTMLInputElement>("word");
  const sizeSelect = byId<HTMLSelectElement>("size");
  const difficultySelect = byId<HTMLSelectElement>("difficulty");
  const mazeLetterAmountField = byId<HTMLLabelElement>("maze-letter-amount-field");
  const mazeLetterAmountSelect = byId<HTMLSelectElement>("maze-letter-amount");
  const generateButton = byId<HTMLButtonElement>("generate");
  const toggleSolutionButton = byId<HTMLButtonElement>("toggle-solution");
  const printButton = byId<HTMLButtonElement>("print");
  const worksheet = byId<HTMLDivElement>("worksheet");
  const worksheetMeta = byId<HTMLDivElement>("worksheet-meta");
  const printTitle = byId<HTMLHeadingElement>("print-title");
  const answerBoxes = byId<HTMLDivElement>("answer-boxes");
  const status = byId<HTMLParagraphElement>("status");

  let currentPuzzle: Puzzle | null = null;
  let showSolution = false;

  function renderCurrentPuzzle(): void {
    if (!currentPuzzle) {
      return;
    }

    const title = puzzleKindLabels[currentPuzzle.kind];

    worksheet.innerHTML = renderSvg(currentPuzzle, { showSolution });
    printTitle.textContent = title;
    worksheetMeta.textContent = renderWorksheetMeta(currentPuzzle, title);
    renderAnswerBoxes(currentPuzzle, answerBoxes);
  }

  function regenerate(): void {
    showSolution = false;
    toggleSolutionButton.textContent = "Lösung anzeigen";
    updateVariantControls();

    try {
      currentPuzzle = generatePuzzle({
        kind: kindSelect.value as PuzzleKind,
        word: wordInput.value,
        cols: Number(sizeSelect.value),
        difficulty: difficultySelect.value as Difficulty,
        mazeLetterAmount: mazeLetterAmountSelect.value as MazeLetterAmount,
      });
      status.textContent = "";
      renderCurrentPuzzle();
    } catch (error) {
      currentPuzzle = null;
      worksheet.textContent = "";
      worksheetMeta.textContent = "";
      answerBoxes.hidden = true;
      answerBoxes.textContent = "";
      printTitle.textContent = "Buchstabenlabyrinth";
      status.textContent = error instanceof Error ? error.message : "Fehler beim Erzeugen.";
    }
  }

  function updateVariantControls(): void {
    mazeLetterAmountField.hidden = kindSelect.value !== "maze";
  }

  kindSelect.addEventListener("change", regenerate);
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

  updateVariantControls();
  regenerate();
}

function renderWorksheetMeta(puzzle: Puzzle, title: string): string {
  const base = `${title} · ${puzzle.cols} × ${puzzle.rows} · ${difficultyLabels[puzzle.difficulty]}`;

  if (puzzle.kind === "maze") {
    return `${base} · Buchstaben: ${mazeLetterAmountLabels[puzzle.mazeLetterAmount]}`;
  }

  return `${base} · Wort: ${puzzle.word}`;
}

function renderAnswerBoxes(puzzle: Puzzle, container: HTMLDivElement): void {
  if (puzzle.kind !== "maze") {
    container.hidden = true;
    container.textContent = "";
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="answer-boxes-label">Lösungswort</div>
    <div class="answer-boxes-cells">
      ${Array.from({ length: puzzle.word.length }, () => '<span class="answer-box"></span>').join("")}
    </div>
  `;
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
