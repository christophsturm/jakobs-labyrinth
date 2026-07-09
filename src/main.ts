import * as v from "valibot";

export type Difficulty = "easy" | "medium" | "hard";

export type PuzzleKind = "maze" | "wordSearch";

export type MazeLetterAmount = "few" | "normal" | "many";

export type PuzzleLanguage = "de" | "en" | "it" | "fr";

export type Point = {
  x: number;
  y: number;
};

export type BasePuzzle = {
  kind: PuzzleKind;
  language: PuzzleLanguage;
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

export type NormalizedWordFeedback = {
  word: string;
  changed: boolean;
  removedCharacters: boolean;
  hadInput: boolean;
};

type Random = () => number;

type IsExactType<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;
type AssertType<T extends true> = T;

type GeneratePuzzleOptions = {
  kind?: PuzzleKind;
  language?: PuzzleLanguage;
  word: string;
  cols: number;
  rows?: number;
  difficulty: Difficulty;
  mazeLetterAmount?: MazeLetterAmount;
  seed?: number;
};

export type PuzzleUrlSettings = {
  kind?: PuzzleKind;
  word?: string;
  cols?: number;
  difficulty?: Difficulty;
  mazeLetterAmount?: MazeLetterAmount;
  seed?: number;
  savedSeeds?: number[];
};

export type CompletePuzzleUrlSettings = {
  kind: PuzzleKind;
  word: string;
  cols: number;
  difficulty: Difficulty;
  mazeLetterAmount: MazeLetterAmount;
  seed: number;
  savedSeeds?: number[] | undefined;
};

type PuzzleUrlEntry = Omit<CompletePuzzleUrlSettings, "savedSeeds">;

export type PuzzleUrlParseResult = {
  settings: PuzzleUrlSettings;
  invalidParams: PuzzleUrlInvalidParam[];
};

export type PuzzleUrlInvalidParam = {
  name: string;
  value: string;
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
const defaultLanguage: PuzzleLanguage = "de";
const baseAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const puzzleKindOptions = ["maze", "wordSearch"] as const;
const difficultyOptions = ["easy", "medium", "hard"] as const;
const mazeLetterAmountOptions = ["few", "normal", "many"] as const;
const urlSizeOptions = [8, 10, 12] as const;
const maxUrlSeed = 0xffffffff;
const urlParamNames = {
  kind: "kind",
  word: "word",
  cols: "size",
  difficulty: "difficulty",
  mazeLetterAmount: "letters",
  seed: "seed",
  savedSeeds: "saved",
  additionalPuzzle: "puzzle",
} as const;

type _PuzzleKindOptionsMatchInternalType = AssertType<
  IsExactType<(typeof puzzleKindOptions)[number], PuzzleKind>
>;
type _DifficultyOptionsMatchInternalType = AssertType<
  IsExactType<(typeof difficultyOptions)[number], Difficulty>
>;
type _MazeLetterAmountOptionsMatchInternalType = AssertType<
  IsExactType<(typeof mazeLetterAmountOptions)[number], MazeLetterAmount>
>;

const puzzleKindSchema = v.picklist(puzzleKindOptions);
const difficultySchema = v.picklist(difficultyOptions);
const mazeLetterAmountSchema = v.picklist(mazeLetterAmountOptions);
const urlWordSchema = v.pipe(
  v.string(),
  v.transform((value) => value.trim()),
  v.check((value) => value.length > 0, "Word must not be empty."),
);
const urlEncodedWordReadSchema = v.pipe(
  v.string(),
  v.transform((value) => decodeUrlWordParam(value) ?? value),
  urlWordSchema,
);
const urlColsReadSchema = v.pipe(
  v.string(),
  v.check(isUrlSizeOptionParam, "Unsupported puzzle size."),
  v.transform((value) => Number(value)),
);
const urlColsWriteSchema = v.pipe(
  v.number(),
  v.integer(),
  v.check(isUrlSizeOption, "Unsupported puzzle size."),
);
const urlSeedReadSchema = v.pipe(
  v.string(),
  v.check((value) => /^\d+$/.test(value), "Seed must be a positive integer."),
  v.transform((value) => Number(value)),
  v.integer(),
  v.minValue(1),
  v.maxValue(maxUrlSeed),
);
const urlSeedWriteSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(maxUrlSeed));
const urlSavedSeedsReadSchema = v.pipe(
  v.string(),
  v.check((value) => value.length > 0, "Saved seeds must not be empty."),
  v.transform((value) => value.split(",")),
  v.check(
    (values) => values.every((value) => /^\d+$/.test(value)),
    "Saved seeds must be positive integers.",
  ),
  v.transform((values) => values.map((value) => Number(value))),
  v.check(
    (values) =>
      values.every((value) => Number.isInteger(value) && value >= 1 && value <= maxUrlSeed),
    "Saved seeds must fit in the supported seed range.",
  ),
);
const urlSavedSeedsWriteSchema = v.optional(v.array(urlSeedWriteSchema));
const completePuzzleUrlSettingsSchema = v.object({
  kind: puzzleKindSchema,
  word: urlWordSchema,
  cols: urlColsWriteSchema,
  difficulty: difficultySchema,
  mazeLetterAmount: mazeLetterAmountSchema,
  seed: urlSeedWriteSchema,
  savedSeeds: urlSavedSeedsWriteSchema,
});
const puzzleUrlEntrySchema = v.object({
  kind: puzzleKindSchema,
  word: urlWordSchema,
  cols: urlColsWriteSchema,
  difficulty: difficultySchema,
  mazeLetterAmount: mazeLetterAmountSchema,
  seed: urlSeedWriteSchema,
});
type _PuzzleKindSchemaMatchesInternalType = AssertType<
  IsExactType<v.InferOutput<typeof puzzleKindSchema>, PuzzleKind>
>;
type _DifficultySchemaMatchesInternalType = AssertType<
  IsExactType<v.InferOutput<typeof difficultySchema>, Difficulty>
>;
type _MazeLetterAmountSchemaMatchesInternalType = AssertType<
  IsExactType<v.InferOutput<typeof mazeLetterAmountSchema>, MazeLetterAmount>
>;
type _CompletePuzzleUrlSettingsSchemaMatchesInternalType = AssertType<
  IsExactType<v.InferOutput<typeof completePuzzleUrlSettingsSchema>, CompletePuzzleUrlSettings>
>;

const directions: DirectionVector[] = [
  { direction: "top", opposite: "bottom", dx: 0, dy: -1 },
  { direction: "right", opposite: "left", dx: 1, dy: 0 },
  { direction: "bottom", opposite: "top", dx: 0, dy: 1 },
  { direction: "left", opposite: "right", dx: -1, dy: 0 },
];

type LanguageLabels = {
  htmlLang: string;
  appTitle: string;
  screenTitle: string;
  controlsLabel: string;
  languageField: string;
  kindField: string;
  wordField: string;
  sizeField: string;
  difficultyField: string;
  mazeLetterAmountField: string;
  addPuzzle: string;
  deletePuzzle: (index: number) => string;
  demo: string;
  emptyState: string;
  githubLink: string;
  printSource: string;
  showSolution: string;
  hideSolution: string;
  print: string;
  printCount: (count: number) => string;
  name: string;
  date: string;
  wordMeta: string;
  lettersMeta: string;
  answerWord: string;
  urlSettingsAdjusted: (details: string) => string;
  invalidWord: string;
  unsupportedCharacters: (word: string) => string;
  gridSize: (max: number) => string;
  wordTooLongGrid: string;
  wordTooLongMaze: string;
  mazeGenerationFailed: string;
  puzzleKinds: Record<PuzzleKind, string>;
  difficulties: Record<Difficulty, string>;
  mazeLetterAmounts: Record<MazeLetterAmount, string>;
  wordSearchDesc: (cols: number, rows: number, difficulty: string) => string;
  mazeDesc: (cols: number, rows: number, difficulty: string) => string;
};

type LanguageConfig = {
  locale: string;
  alphabet: string;
  labels: LanguageLabels;
};

const languageConfigs: Record<PuzzleLanguage, LanguageConfig> = {
  de: {
    locale: "de-DE",
    alphabet,
    labels: {
      htmlLang: "de",
      appTitle: "Jakobs Labyrinth Drucker",
      screenTitle: "Jakobs Labyrinth Drucker",
      controlsLabel: "Einstellungen",
      languageField: "Sprache",
      kindField: "Variante",
      wordField: "Lösungswort",
      sizeField: "Größe",
      difficultyField: "Schwierigkeit",
      mazeLetterAmountField: "Buchstabenmenge",
      addPuzzle: "Puzzle anlegen",
      deletePuzzle: (index) => `Puzzle ${index} löschen`,
      demo: "Demo",
      emptyState: "Noch keine Puzzles. Lege links dein erstes an.",
      githubLink: "Auf GitHub ansehen",
      printSource: "Erstellt mit",
      showSolution: "Lösung anzeigen",
      hideSolution: "Lösung verstecken",
      print: "Drucken",
      printCount: (count) => `Drucken (${count})`,
      name: "Name",
      date: "Datum",
      wordMeta: "Wort",
      lettersMeta: "Buchstaben",
      answerWord: "Lösungswort",
      urlSettingsAdjusted: (details) => `Ungültige Link-Werte korrigiert: ${details}.`,
      invalidWord: "Bitte ein Wort aus Buchstaben A-Z, Ä, Ö oder Ü eingeben.",
      unsupportedCharacters: (word) =>
        `Nicht unterstützte Zeichen wurden entfernt. Verwendetes Wort: ${word}.`,
      gridSize: (max) => `Das Raster muss zwischen 4 und ${max} Feldern groß sein.`,
      wordTooLongGrid: "Das Wort ist zu lang für dieses Raster.",
      wordTooLongMaze: "Das Wort ist zu lang für dieses Labyrinth.",
      mazeGenerationFailed: "Das Labyrinth konnte nicht erzeugt werden.",
      puzzleKinds: {
        maze: "Labyrinth",
        wordSearch: "Wortsuchbild",
      },
      difficulties: {
        easy: "Leicht",
        medium: "Mittel",
        hard: "Schwer",
      },
      mazeLetterAmounts: {
        few: "Wenig",
        normal: "Mehr",
        many: "Viele",
      },
      wordSearchDesc: (cols, rows, difficulty) =>
        `${cols} mal ${rows} Felder, Schwierigkeit ${difficulty}`,
      mazeDesc: (cols, rows, difficulty) =>
        `Ein Labyrinth mit Mauern, ${cols} mal ${rows} Felder, Schwierigkeit ${difficulty}`,
    },
  },
  en: {
    locale: "en-US",
    alphabet: baseAlphabet,
    labels: {
      htmlLang: "en",
      appTitle: "Jakob's Maze Printer",
      screenTitle: "Jakob's Maze Printer",
      controlsLabel: "Settings",
      languageField: "Language",
      kindField: "Puzzle type",
      wordField: "Solution word",
      sizeField: "Size",
      difficultyField: "Difficulty",
      mazeLetterAmountField: "Letter amount",
      addPuzzle: "Add puzzle",
      deletePuzzle: (index) => `Delete puzzle ${index}`,
      demo: "Demo",
      emptyState: "No puzzles yet. Add your first one on the left.",
      githubLink: "View on GitHub",
      printSource: "Created with",
      showSolution: "Show solution",
      hideSolution: "Hide solution",
      print: "Print",
      printCount: (count) => `Print (${count})`,
      name: "Name",
      date: "Date",
      wordMeta: "Word",
      lettersMeta: "Letters",
      answerWord: "Solution word",
      urlSettingsAdjusted: (details) => `Invalid link values corrected: ${details}.`,
      invalidWord: "Please enter a word using letters A-Z.",
      unsupportedCharacters: (word) => `Unsupported characters were removed. Used word: ${word}.`,
      gridSize: (max) => `The grid must be between 4 and ${max} cells wide.`,
      wordTooLongGrid: "The word is too long for this grid.",
      wordTooLongMaze: "The word is too long for this maze.",
      mazeGenerationFailed: "The maze could not be generated.",
      puzzleKinds: {
        maze: "Letter maze",
        wordSearch: "Word search",
      },
      difficulties: {
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
      },
      mazeLetterAmounts: {
        few: "Few",
        normal: "More",
        many: "Many",
      },
      wordSearchDesc: (cols, rows, difficulty) =>
        `${cols} by ${rows} cells, difficulty ${difficulty}`,
      mazeDesc: (cols, rows, difficulty) =>
        `A walled maze, ${cols} by ${rows} cells, difficulty ${difficulty}`,
    },
  },
  it: {
    locale: "it-IT",
    alphabet: baseAlphabet,
    labels: {
      htmlLang: "it",
      appTitle: "Stampante per labirinti di Jakob",
      screenTitle: "Stampante per labirinti di Jakob",
      controlsLabel: "Impostazioni",
      languageField: "Lingua",
      kindField: "Tipo",
      wordField: "Parola soluzione",
      sizeField: "Dimensione",
      difficultyField: "Difficoltà",
      mazeLetterAmountField: "Quantità lettere",
      addPuzzle: "Aggiungi puzzle",
      deletePuzzle: (index) => `Elimina il puzzle ${index}`,
      demo: "Esempio",
      emptyState: "Non ci sono ancora puzzle. Aggiungi il primo a sinistra.",
      githubLink: "Vedi su GitHub",
      printSource: "Creato con",
      showSolution: "Mostra soluzione",
      hideSolution: "Nascondi soluzione",
      print: "Stampa",
      printCount: (count) => `Stampa (${count})`,
      name: "Nome",
      date: "Data",
      wordMeta: "Parola",
      lettersMeta: "Lettere",
      answerWord: "Parola soluzione",
      urlSettingsAdjusted: (details) => `Valori non validi del link corretti: ${details}.`,
      invalidWord: "Inserisci una parola con lettere A-Z.",
      unsupportedCharacters: (word) =>
        `I caratteri non supportati sono stati rimossi. Parola usata: ${word}.`,
      gridSize: (max) => `La griglia deve avere tra 4 e ${max} celle.`,
      wordTooLongGrid: "La parola è troppo lunga per questa griglia.",
      wordTooLongMaze: "La parola è troppo lunga per questo labirinto.",
      mazeGenerationFailed: "Impossibile generare il labirinto.",
      puzzleKinds: {
        maze: "Labirinto di lettere",
        wordSearch: "Cerca parole",
      },
      difficulties: {
        easy: "Facile",
        medium: "Medio",
        hard: "Difficile",
      },
      mazeLetterAmounts: {
        few: "Poche",
        normal: "Normale",
        many: "Molte",
      },
      wordSearchDesc: (cols, rows, difficulty) =>
        `${cols} per ${rows} celle, difficoltà ${difficulty}`,
      mazeDesc: (cols, rows, difficulty) =>
        `Un labirinto con muri, ${cols} per ${rows} celle, difficoltà ${difficulty}`,
    },
  },
  fr: {
    locale: "fr-FR",
    alphabet: baseAlphabet,
    labels: {
      htmlLang: "fr",
      appTitle: "Imprimante de labyrinthes de Jakob",
      screenTitle: "Imprimante de labyrinthes de Jakob",
      controlsLabel: "Réglages",
      languageField: "Langue",
      kindField: "Type",
      wordField: "Mot solution",
      sizeField: "Taille",
      difficultyField: "Difficulté",
      mazeLetterAmountField: "Quantité de lettres",
      addPuzzle: "Ajouter un puzzle",
      deletePuzzle: (index) => `Supprimer le puzzle ${index}`,
      demo: "Démo",
      emptyState: "Aucun puzzle pour l’instant. Ajoutez le premier à gauche.",
      githubLink: "Voir sur GitHub",
      printSource: "Créé avec",
      showSolution: "Afficher solution",
      hideSolution: "Masquer solution",
      print: "Imprimer",
      printCount: (count) => `Imprimer (${count})`,
      name: "Nom",
      date: "Date",
      wordMeta: "Mot",
      lettersMeta: "Lettres",
      answerWord: "Mot solution",
      urlSettingsAdjusted: (details) => `Valeurs invalides du lien corrigées : ${details}.`,
      invalidWord: "Saisir un mot avec les lettres A-Z.",
      unsupportedCharacters: (word) =>
        `Les caractères non pris en charge ont été retirés. Mot utilisé : ${word}.`,
      gridSize: (max) => `La grille doit contenir entre 4 et ${max} cases.`,
      wordTooLongGrid: "Le mot est trop long pour cette grille.",
      wordTooLongMaze: "Le mot est trop long pour ce labyrinthe.",
      mazeGenerationFailed: "Le labyrinthe n'a pas pu être généré.",
      puzzleKinds: {
        maze: "Labyrinthe de lettres",
        wordSearch: "Mots mêlés",
      },
      difficulties: {
        easy: "Facile",
        medium: "Moyen",
        hard: "Difficile",
      },
      mazeLetterAmounts: {
        few: "Peu",
        normal: "Plus",
        many: "Beaucoup",
      },
      wordSearchDesc: (cols, rows, difficulty) =>
        `${cols} par ${rows} cases, difficulté ${difficulty}`,
      mazeDesc: (cols, rows, difficulty) =>
        `Un labyrinthe avec murs, ${cols} par ${rows} cases, difficulté ${difficulty}`,
    },
  },
};

export function normalizeWord(input: string, language: PuzzleLanguage = defaultLanguage): string {
  return normalizeWordWithFeedback(input, language).word;
}

export function normalizeWordWithFeedback(
  input: string,
  language: PuzzleLanguage = defaultLanguage,
): NormalizedWordFeedback {
  validatePuzzleLanguage(language);

  const config = languageConfigs[language];
  const trimmed = input.normalize("NFC").trim();
  const uppercased = trimmed.toLocaleUpperCase(config.locale);
  const normalized = language === "de" ? uppercased : foldToBaseLatin(uppercased);
  const word = normalized.replace(allowedLetterPattern(language), "");
  const removedCharacters = word.length !== normalized.length;

  return {
    word,
    changed: word !== uppercased,
    removedCharacters,
    hadInput: trimmed.length > 0,
  };
}

export function languageFromLocales(locales: readonly string[]): PuzzleLanguage {
  for (const locale of locales) {
    const language = locale.toLowerCase().split("-")[0] ?? "";

    if (isPuzzleLanguage(language)) {
      return language;
    }
  }

  return defaultLanguage;
}

export function parsePuzzleSettingsFromUrl(input: string | URLSearchParams): PuzzleUrlSettings {
  return parsePuzzleSettingsFromUrlWithIssues(input).settings;
}

export function parsePuzzleSettingsFromUrlWithIssues(
  input: string | URLSearchParams,
): PuzzleUrlParseResult {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const settings: PuzzleUrlSettings = {};
  const invalidParams: PuzzleUrlInvalidParam[] = [];
  const kind = readUrlParam(params, urlParamNames.kind, puzzleKindSchema, invalidParams);
  const word = readUrlParam(params, urlParamNames.word, urlEncodedWordReadSchema, invalidParams);
  const cols = readUrlParam(params, urlParamNames.cols, urlColsReadSchema, invalidParams);
  const difficulty = readUrlParam(
    params,
    urlParamNames.difficulty,
    difficultySchema,
    invalidParams,
  );
  const mazeLetterAmount = readUrlParam(
    params,
    urlParamNames.mazeLetterAmount,
    mazeLetterAmountSchema,
    invalidParams,
  );
  const seed = readUrlParam(params, urlParamNames.seed, urlSeedReadSchema, invalidParams);
  const savedSeeds = readUrlParam(
    params,
    urlParamNames.savedSeeds,
    urlSavedSeedsReadSchema,
    invalidParams,
  );

  if (kind) {
    settings.kind = kind;
  }

  if (word) {
    settings.word = word;
  }

  if (cols) {
    settings.cols = cols;
  }

  if (difficulty) {
    settings.difficulty = difficulty;
  }

  if (mazeLetterAmount) {
    settings.mazeLetterAmount = mazeLetterAmount;
  }

  if (seed) {
    settings.seed = seed;
  }

  if (savedSeeds && savedSeeds.length > 0) {
    settings.savedSeeds = savedSeeds;
  }

  return { settings, invalidParams };
}

export function createPuzzleUrlSearchParams(settings: CompletePuzzleUrlSettings): URLSearchParams {
  const validSettings = v.parse(completePuzzleUrlSettingsSchema, settings);
  const params = new URLSearchParams();

  params.set(urlParamNames.kind, validSettings.kind);
  params.set(urlParamNames.word, encodeUrlWord(validSettings.word));
  params.set(urlParamNames.cols, String(validSettings.cols));
  params.set(urlParamNames.difficulty, validSettings.difficulty);
  params.set(urlParamNames.mazeLetterAmount, validSettings.mazeLetterAmount);
  params.set(urlParamNames.seed, String(validSettings.seed));

  if (validSettings.savedSeeds && validSettings.savedSeeds.length > 0) {
    params.set(urlParamNames.savedSeeds, validSettings.savedSeeds.join(","));
  }

  return params;
}

export function baseUrlFromLocation(input: string): string {
  const url = new URL(input);

  url.search = "";
  url.hash = "";

  return url.toString();
}

export function createPuzzleCollectionUrlSearchParams(puzzles: readonly Puzzle[]): URLSearchParams {
  const [firstPuzzle, ...additionalPuzzles] = puzzles;

  if (!firstPuzzle) {
    return new URLSearchParams();
  }

  const params = createPuzzleUrlSearchParams(puzzleUrlEntryFromPuzzle(firstPuzzle));

  for (const puzzle of additionalPuzzles) {
    params.append(
      urlParamNames.additionalPuzzle,
      encodeAdditionalPuzzleUrlEntry(puzzleUrlEntryFromPuzzle(puzzle)),
    );
  }

  return params;
}

export function parseAdditionalPuzzleSettingsFromUrl(input: string | URLSearchParams): {
  entries: PuzzleUrlEntry[];
  invalidParams: PuzzleUrlInvalidParam[];
} {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const entries: PuzzleUrlEntry[] = [];
  const invalidParams: PuzzleUrlInvalidParam[] = [];

  for (const value of params.getAll(urlParamNames.additionalPuzzle)) {
    const entry = decodeAdditionalPuzzleUrlEntry(value);

    if (entry) {
      entries.push(entry);
    } else {
      invalidParams.push({ name: urlParamNames.additionalPuzzle, value });
    }
  }

  return { entries, invalidParams };
}

function puzzleUrlEntryFromPuzzle(puzzle: Puzzle): PuzzleUrlEntry {
  return {
    kind: puzzle.kind,
    word: puzzle.word,
    cols: puzzle.cols,
    difficulty: puzzle.difficulty,
    mazeLetterAmount: puzzle.kind === "maze" ? puzzle.mazeLetterAmount : "normal",
    seed: puzzle.seed,
  };
}

function encodeAdditionalPuzzleUrlEntry(entry: PuzzleUrlEntry): string {
  return encodeBase64Url(JSON.stringify(v.parse(puzzleUrlEntrySchema, entry)));
}

function decodeAdditionalPuzzleUrlEntry(value: string): PuzzleUrlEntry | null {
  const decoded = decodeBase64Url(value);

  if (decoded === null) {
    return null;
  }

  try {
    const result = v.safeParse(puzzleUrlEntrySchema, JSON.parse(decoded));
    return result.success ? result.output : null;
  } catch {
    return null;
  }
}

function encodeUrlWord(value: string): string {
  return encodeBase64Url(value);
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeUrlWordParam(value: string): string | null {
  const decoded = decodeBase64Url(value);

  return decoded !== null && looksLikeDecodedUrlWord(decoded) ? decoded : null;
}

function decodeBase64Url(value: string): string | null {
  const candidate = value.trim();

  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(candidate)) {
    return null;
  }

  const base64 = candidate.replaceAll("-", "+").replaceAll("_", "/");
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function looksLikeDecodedUrlWord(value: string): boolean {
  const trimmed = value.trim();

  for (const char of trimmed) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return false;
    }
  }

  return trimmed.length > 0 && /\p{L}/u.test(trimmed);
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
  const kind = options.kind ?? "maze";
  const language = options.language ?? defaultLanguage;

  validatePuzzleKind(kind);
  validatePuzzleLanguage(language);
  validateDifficulty(options.difficulty);

  if (kind === "wordSearch") {
    return generateWordSearchPuzzle({ ...options, language });
  }

  return generateMazePuzzle({ ...options, kind, language });
}

export function generateWordSearchPuzzle(options: GeneratePuzzleOptions): WordSearchPuzzle {
  const language = options.language ?? defaultLanguage;
  const word = normalizeWord(options.word, language);
  const rows = options.rows ?? options.cols;
  const { cols, difficulty } = options;

  validatePuzzleLanguage(language);
  validateDifficulty(difficulty);
  validatePuzzleInput(word, cols, rows, language);

  const config = languageConfigs[language];
  const seed = resolveSeed(options, "wordSearch", language, word, cols, rows, difficulty);
  const rng = createRandom(seed);
  const solutionPath = generateWordSearchPath(word.length, cols, rows, difficulty, rng);
  const wordLetterPoints = [...solutionPath];
  const letters = fillGrid(word, cols, rows, difficulty, config.alphabet, rng);

  placeWordLetters(letters, word, wordLetterPoints);

  return {
    kind: "wordSearch",
    language,
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
  const language = options.language ?? defaultLanguage;
  const word = normalizeWord(options.word, language);
  const rows = options.rows ?? options.cols;
  const { cols, difficulty } = options;
  const mazeLetterAmount = options.mazeLetterAmount ?? "normal";

  validatePuzzleLanguage(language);
  validateDifficulty(difficulty);
  validatePuzzleInput(word, cols, rows, language);
  validateMazeLetterAmount(mazeLetterAmount);

  const config = languageConfigs[language];
  const seed = resolveSeed(
    options,
    "maze",
    language,
    word,
    cols,
    rows,
    difficulty,
    mazeLetterAmount,
  );
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
    throw new Error(config.labels.wordTooLongMaze);
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
    config.alphabet,
    rng,
  );

  const start = solutionPath[0];
  const end = solutionPath[solutionPath.length - 1];

  if (!start || !end) {
    throw new Error(config.labels.mazeGenerationFailed);
  }

  const entrance = { point: start, side: entranceSide };
  const exit = { point: end, side: exitSide };

  openBoundaryWall(maze, entrance);
  openBoundaryWall(maze, exit);

  return {
    kind: "maze",
    language,
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
  language: PuzzleLanguage,
  word: string,
  cols: number,
  rows: number,
  difficulty: Difficulty,
  mazeLetterAmount?: MazeLetterAmount,
): number {
  return (
    options.seed ??
    makeSeed(
      `${kind}:${language}:${word}:${cols}:${rows}:${difficulty}:${mazeLetterAmount ?? "n/a"}:${Date.now()}:${Math.random()}`,
    )
  );
}

function validatePuzzleInput(
  word: string,
  cols: number,
  rows: number,
  language: PuzzleLanguage,
): void {
  const labels = languageConfigs[language].labels;

  if (!word) {
    throw new Error(labels.invalidWord);
  }

  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols < 4 ||
    rows < 4 ||
    cols > maxGridSize ||
    rows > maxGridSize
  ) {
    throw new Error(labels.gridSize(maxGridSize));
  }

  if (word.length > cols * rows) {
    throw new Error(labels.wordTooLongGrid);
  }
}

function validatePuzzleKind(value: string): asserts value is PuzzleKind {
  if (value !== "maze" && value !== "wordSearch") {
    throw new Error("Ungültige Variante.");
  }
}

function validateDifficulty(value: string): asserts value is Difficulty {
  if (value !== "easy" && value !== "medium" && value !== "hard") {
    throw new Error("Ungültige Schwierigkeit.");
  }
}

function validatePuzzleLanguage(value: string): asserts value is PuzzleLanguage {
  if (!isPuzzleLanguage(value)) {
    throw new Error("Ungültige Sprache.");
  }
}

function isPuzzleLanguage(value: string): value is PuzzleLanguage {
  return value === "de" || value === "en" || value === "it" || value === "fr";
}

function isUrlSizeOption(value: number): boolean {
  return urlSizeOptions.some((option) => option === value);
}

function isUrlSizeOptionParam(value: string): boolean {
  return urlSizeOptions.some((option) => String(option) === value);
}

function validateMazeLetterAmount(value: string): asserts value is MazeLetterAmount {
  if (value !== "few" && value !== "normal" && value !== "many") {
    throw new Error("Ungültige Buchstabenmenge für das Labyrinth.");
  }
}

function foldToBaseLatin(value: string): string {
  return value
    .replaceAll("Æ", "AE")
    .replaceAll("Œ", "OE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function allowedLetterPattern(language: PuzzleLanguage): RegExp {
  return language === "de" ? /[^A-ZÄÖÜ]/g : /[^A-Z]/g;
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
  fillerAlphabet: string,
  rng: Random,
): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => randomFillerLetter(word, difficulty, fillerAlphabet, rng)),
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
  fillerAlphabet: string,
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
    letters[point.y]![point.x] = randomFillerLetter(word, difficulty, fillerAlphabet, rng);
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

function randomFillerLetter(
  word: string,
  difficulty: Difficulty,
  fillerAlphabet: string,
  rng: Random,
): string {
  const distractorChance: Record<Difficulty, number> = {
    easy: 0.07,
    medium: 0.17,
    hard: 0.34,
  };

  if (rng() < distractorChance[difficulty]) {
    const index = Math.floor(rng() * word.length);
    return word[index] ?? alphabet[0] ?? "A";
  }

  const index = Math.floor(rng() * fillerAlphabet.length);
  return fillerAlphabet[index] ?? "A";
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
  const labels = languageConfigs[puzzle.language].labels;
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
    ? `${renderCenteredPolyline(
        puzzle.solutionPath,
        cell,
        padding,
        "#0b5f3a",
        7,
        0.58,
        "solution-layer print-hidden-solution",
      )}`
    : "";

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="${width}"
      height="${height}"
      role="img"
      aria-label="${labels.puzzleKinds.wordSearch}: ${escapeHtml(puzzle.word)}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>${labels.puzzleKinds.wordSearch}: ${escapeHtml(puzzle.word)}</title>
      <desc>${escapeHtml(
        labels.wordSearchDesc(puzzle.cols, puzzle.rows, labels.difficulties[puzzle.difficulty]),
      )}</desc>
      ${cells.join("")}
      ${solutionLayer}
    </svg>
  `;
}

function renderMazeSvg(puzzle: MazePuzzle, options: { showSolution: boolean }): string {
  const labels = languageConfigs[puzzle.language].labels;
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
                  class="solution-highlight print-hidden-solution"
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
    ? renderCenteredPolyline(
        puzzle.solutionPath,
        cell,
        padding,
        "#0b5f3a",
        12,
        0.28,
        "solution-layer print-hidden-solution",
      )
    : "";

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      width="${width}"
      height="${height}"
      role="img"
      aria-label="${labels.puzzleKinds.maze}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>${labels.puzzleKinds.maze}</title>
      <desc>${escapeHtml(labels.mazeDesc(puzzle.cols, puzzle.rows, labels.difficulties[puzzle.difficulty]))}</desc>
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
  className?: string,
): string {
  const points = path
    .map((point) => `${padding + point.x * cell + cell / 2},${padding + point.y * cell + cell / 2}`)
    .join(" ");
  const classAttribute = className ? `class="${escapeHtml(className)}"` : "";

  return `
    <polyline
      ${classAttribute}
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

function renderMazeOpenings(puzzle: MazePuzzle, cell: number, padding: number): string {
  return `
    ${renderOpeningArrow(puzzle.entrance, "entrance", cell, padding)}
    ${renderOpeningArrow(puzzle.exit, "exit", cell, padding)}
  `;
}

function renderOpeningArrow(
  opening: MazeOpening,
  kind: "entrance" | "exit",
  cell: number,
  padding: number,
): string {
  const center = openingBoundaryCenter(opening, cell, padding);
  const inward = openingInwardVector(opening.side);
  const direction = kind === "entrance" ? inward : { dx: -inward.dx, dy: -inward.dy };
  const fill = kind === "entrance" ? "#36a96a" : "#ef7258";
  const outsideLength = 22;
  const tipInset = 1;
  const startOffset = kind === "entrance" ? -outsideLength : tipInset;
  const tipOffset = kind === "entrance" ? tipInset : -outsideLength;
  const start = {
    x: center.x + inward.dx * startOffset,
    y: center.y + inward.dy * startOffset,
  };
  const tip = {
    x: center.x + inward.dx * tipOffset,
    y: center.y + inward.dy * tipOffset,
  };
  const headLength = 11;
  const bodyHalf = 6;
  const headHalf = 14;
  const shaftEnd = {
    x: tip.x - direction.dx * headLength,
    y: tip.y - direction.dy * headLength,
  };
  const perpendicular = { x: -direction.dy, y: direction.dx };
  const tailLeft = {
    x: start.x + perpendicular.x * bodyHalf,
    y: start.y + perpendicular.y * bodyHalf,
  };
  const neckLeft = {
    x: shaftEnd.x + perpendicular.x * bodyHalf,
    y: shaftEnd.y + perpendicular.y * bodyHalf,
  };
  const headLeft = {
    x: shaftEnd.x + perpendicular.x * headHalf,
    y: shaftEnd.y + perpendicular.y * headHalf,
  };
  const headRight = {
    x: shaftEnd.x - perpendicular.x * headHalf,
    y: shaftEnd.y - perpendicular.y * headHalf,
  };
  const neckRight = {
    x: shaftEnd.x - perpendicular.x * bodyHalf,
    y: shaftEnd.y - perpendicular.y * bodyHalf,
  };
  const tailRight = {
    x: start.x - perpendicular.x * bodyHalf,
    y: start.y - perpendicular.y * bodyHalf,
  };
  const className = `maze-opening-arrow maze-opening-${kind}`;
  const points = [tailLeft, neckLeft, headLeft, tip, headRight, neckRight, tailRight]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return `
    <g class="${className}">
      <polygon
        points="${points}"
        fill="${fill}"
        stroke="#171a16"
        stroke-width="2.4"
        stroke-linejoin="round"
      />
    </g>
  `;
}

function openingBoundaryCenter(opening: MazeOpening, cell: number, padding: number): Point {
  const centerX = padding + opening.point.x * cell + cell / 2;
  const centerY = padding + opening.point.y * cell + cell / 2;

  if (opening.side === "left") {
    return { x: padding + opening.point.x * cell, y: centerY };
  }

  if (opening.side === "right") {
    return { x: padding + (opening.point.x + 1) * cell, y: centerY };
  }

  if (opening.side === "top") {
    return { x: centerX, y: padding + opening.point.y * cell };
  }

  return { x: centerX, y: padding + (opening.point.y + 1) * cell };
}

function openingInwardVector(side: Direction): Pick<DirectionVector, "dx" | "dy"> {
  if (side === "left") {
    return { dx: 1, dy: 0 };
  }

  if (side === "right") {
    return { dx: -1, dy: 0 };
  }

  if (side === "top") {
    return { dx: 0, dy: 1 };
  }

  return { dx: 0, dy: -1 };
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
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bindApp(): void {
  const controls = byId<HTMLElement>("controls");
  const screenTitle = byId<HTMLHeadingElement>("screen-title");
  const languageLabel = byId<HTMLSpanElement>("language-label");
  const languageSelect = byId<HTMLSelectElement>("language");
  const kindLabel = byId<HTMLSpanElement>("kind-label");
  const kindSelect = byId<HTMLSelectElement>("kind");
  const wordLabel = byId<HTMLSpanElement>("word-label");
  const wordInput = byId<HTMLInputElement>("word");
  const sizeLabel = byId<HTMLSpanElement>("size-label");
  const sizeSelect = byId<HTMLSelectElement>("size");
  const difficultyLabel = byId<HTMLSpanElement>("difficulty-label");
  const difficultySelect = byId<HTMLSelectElement>("difficulty");
  const mazeLetterAmountLabel = byId<HTMLSpanElement>("maze-letter-amount-label");
  const mazeLetterAmountField = byId<HTMLLabelElement>("maze-letter-amount-field");
  const mazeLetterAmountSelect = byId<HTMLSelectElement>("maze-letter-amount");
  const addPuzzleButton = byId<HTMLButtonElement>("add-puzzle");
  const toggleSolutionButton = byId<HTMLButtonElement>("toggle-solution");
  const printButton = byId<HTMLButtonElement>("print");
  const worksheets = byId<HTMLDivElement>("worksheets");
  const status = byId<HTMLParagraphElement>("status");
  const githubLinkLabel = byId<HTMLSpanElement>("github-link-label");

  let puzzles: Puzzle[] = [];
  let showingDemo = false;
  let showSolution = false;
  const initialUrlSettingsResult = parsePuzzleSettingsFromUrlWithIssues(window.location.search);
  const initialUrlSettings = initialUrlSettingsResult.settings;
  const additionalUrlSettingsResult = parseAdditionalPuzzleSettingsFromUrl(window.location.search);

  languageSelect.value = languageFromLocales(
    navigator.languages.length > 0 ? navigator.languages : [navigator.language],
  );

  function currentLanguage(): PuzzleLanguage {
    return parsePuzzleLanguage(languageSelect.value);
  }

  function currentLabels(): LanguageLabels {
    return languageConfigs[currentLanguage()].labels;
  }

  function currentMazeLetterAmount(): MazeLetterAmount {
    return parseMazeLetterAmount(mazeLetterAmountSelect.value);
  }

  function renderPuzzles(): void {
    if (puzzles.length === 0) {
      worksheets.innerHTML = `<div class="empty-state">${escapeHtml(currentLabels().emptyState)}</div>`;
    } else {
      worksheets.innerHTML = renderInteractivePuzzlesHtml(puzzles, {
        showSolution,
        showDemoBadge: showingDemo,
        printSourceUrl: baseUrlFromLocation(window.location.href),
      });
    }

    updateActionButtons();
  }

  function updateActionButtons(): void {
    const labels = currentLabels();
    const printCount = puzzles.length;

    addPuzzleButton.textContent = labels.addPuzzle;
    printButton.textContent = printCount > 1 ? labels.printCount(printCount) : labels.print;
    printButton.disabled = printCount === 0;
    toggleSolutionButton.disabled = printCount === 0;
  }

  function puzzleOptionsFromControls(seed?: number): GeneratePuzzleOptions {
    const puzzleOptions: GeneratePuzzleOptions = {
      kind: parsePuzzleKind(kindSelect.value),
      language: currentLanguage(),
      word: wordInput.value,
      cols: Number(sizeSelect.value),
      difficulty: parseDifficulty(difficultySelect.value),
      mazeLetterAmount: currentMazeLetterAmount(),
    };

    if (seed !== undefined) {
      puzzleOptions.seed = seed;
    }

    return puzzleOptions;
  }

  function generatePuzzleFromControls(seed?: number): Puzzle {
    return generatePuzzle(puzzleOptionsFromControls(seed));
  }

  function generatePuzzleFromUrlEntry(entry: PuzzleUrlEntry): Puzzle {
    return generatePuzzle({
      ...entry,
      language: currentLanguage(),
    });
  }

  function addPuzzle(): void {
    const language = currentLanguage();
    const labels = languageConfigs[language].labels;

    showSolution = false;
    toggleSolutionButton.textContent = labels.showSolution;
    updateVariantControls();

    try {
      const wordFeedback = normalizeWordWithFeedback(wordInput.value, language);
      const puzzle = generatePuzzleFromControls();

      puzzles = showingDemo ? [puzzle] : [...puzzles, puzzle];
      showingDemo = false;
      status.textContent = wordFeedback.removedCharacters
        ? labels.unsupportedCharacters(puzzle.word)
        : "";
      renderPuzzles();
      updatePuzzleUrl();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Fehler beim Erzeugen.";
    }
  }

  function updateVariantControls(): void {
    mazeLetterAmountField.hidden = kindSelect.value !== "maze";
  }

  function applyUrlSettings(settings: PuzzleUrlSettings): void {
    if (settings.kind) {
      setSelectValue(kindSelect, settings.kind);
    }

    if (settings.word) {
      wordInput.value = settings.word;
    }

    if (settings.cols) {
      setSelectValue(sizeSelect, String(settings.cols));
    }

    if (settings.difficulty) {
      setSelectValue(difficultySelect, settings.difficulty);
    }

    if (settings.mazeLetterAmount) {
      setSelectValue(mazeLetterAmountSelect, settings.mazeLetterAmount);
    }
  }

  function updatePuzzleUrl(): void {
    const url = new URL(window.location.href);

    url.search = createPuzzleCollectionUrlSearchParams(showingDemo ? [] : puzzles).toString();
    window.history.replaceState(null, "", url.toString());
  }

  function updateLanguageText(): void {
    const labels = currentLabels();

    document.documentElement.lang = labels.htmlLang;
    document.title = labels.appTitle;
    controls.setAttribute("aria-label", labels.controlsLabel);
    screenTitle.textContent = labels.screenTitle;
    languageLabel.textContent = labels.languageField;
    kindLabel.textContent = labels.kindField;
    wordLabel.textContent = labels.wordField;
    sizeLabel.textContent = labels.sizeField;
    difficultyLabel.textContent = labels.difficultyField;
    mazeLetterAmountLabel.textContent = labels.mazeLetterAmountField;
    githubLinkLabel.textContent = labels.githubLink;
    addPuzzleButton.textContent = labels.addPuzzle;
    printButton.textContent = labels.print;

    setOptionText(kindSelect, "maze", labels.puzzleKinds.maze);
    setOptionText(kindSelect, "wordSearch", labels.puzzleKinds.wordSearch);
    setOptionText(difficultySelect, "easy", labels.difficulties.easy);
    setOptionText(difficultySelect, "medium", labels.difficulties.medium);
    setOptionText(difficultySelect, "hard", labels.difficulties.hard);
    setOptionText(mazeLetterAmountSelect, "few", labels.mazeLetterAmounts.few);
    setOptionText(mazeLetterAmountSelect, "normal", labels.mazeLetterAmounts.normal);
    setOptionText(mazeLetterAmountSelect, "many", labels.mazeLetterAmounts.many);
    toggleSolutionButton.textContent = showSolution ? labels.hideSolution : labels.showSolution;
  }

  function regeneratePuzzlesForLanguage(): void {
    puzzles = puzzles.map((puzzle) =>
      generatePuzzle({
        kind: puzzle.kind,
        language: currentLanguage(),
        word: puzzle.word,
        cols: puzzle.cols,
        rows: puzzle.rows,
        difficulty: puzzle.difficulty,
        mazeLetterAmount: puzzle.kind === "maze" ? puzzle.mazeLetterAmount : "normal",
        seed: puzzle.seed,
      }),
    );
  }

  languageSelect.addEventListener("change", () => {
    try {
      regeneratePuzzlesForLanguage();
      status.textContent = "";
      updateLanguageText();
      renderPuzzles();

      if (!showingDemo) {
        updatePuzzleUrl();
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Fehler beim Erzeugen.";
    }
  });
  kindSelect.addEventListener("change", updateVariantControls);
  addPuzzleButton.addEventListener("click", addPuzzle);
  wordInput.addEventListener("input", () => {
    status.textContent = "";
  });
  wordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addPuzzle();
    }
  });
  toggleSolutionButton.addEventListener("click", () => {
    if (puzzles.length === 0) {
      return;
    }

    showSolution = !showSolution;
    const labels = currentLabels();
    toggleSolutionButton.textContent = showSolution ? labels.hideSolution : labels.showSolution;
    renderPuzzles();
  });
  printButton.addEventListener("click", () => {
    if (puzzles.length === 0) {
      return;
    }

    renderPuzzles();
    window.print();
  });
  worksheets.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest<HTMLButtonElement>("button[data-puzzle-index]");

    if (!button || !worksheets.contains(button)) {
      return;
    }

    const index = Number(button.dataset.puzzleIndex);

    if (!Number.isInteger(index) || index < 0 || index >= puzzles.length) {
      return;
    }

    puzzles = puzzles.filter((_, puzzleIndex) => puzzleIndex !== index);
    showingDemo = false;
    showSolution = false;
    toggleSolutionButton.textContent = currentLabels().showSolution;
    status.textContent = "";
    renderPuzzles();
    updatePuzzleUrl();
  });

  updateLanguageText();
  applyUrlSettings(initialUrlSettings);
  updateVariantControls();
  const invalidUrlParams = [
    ...initialUrlSettingsResult.invalidParams,
    ...additionalUrlSettingsResult.invalidParams,
  ];

  try {
    if (initialUrlSettings.seed === undefined) {
      puzzles = [generatePuzzleFromControls()];
      showingDemo = true;
    } else {
      puzzles = [generatePuzzleFromControls(initialUrlSettings.seed)];
      showingDemo = false;

      for (const seed of initialUrlSettings.savedSeeds ?? []) {
        puzzles.push(generatePuzzleFromControls(seed));
      }

      for (const entry of additionalUrlSettingsResult.entries) {
        puzzles.push(generatePuzzleFromUrlEntry(entry));
      }

      updatePuzzleUrl();
    }

    status.textContent =
      invalidUrlParams.length > 0
        ? currentLabels().urlSettingsAdjusted(
            formatInvalidUrlParams(invalidUrlParams, currentLabels()),
          )
        : "";
  } catch (error) {
    puzzles = [];
    showingDemo = false;
    status.textContent = error instanceof Error ? error.message : "Fehler beim Erzeugen.";
  }

  renderPuzzles();
}

function setOptionText(select: HTMLSelectElement, value: string, label: string): void {
  const option = Array.from(select.options).find((item) => item.value === value);

  if (option) {
    option.textContent = label;
  }
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  if (Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

function formatInvalidUrlParams(
  invalidParams: readonly PuzzleUrlInvalidParam[],
  labels: LanguageLabels,
): string {
  const paramLabels: Record<string, string> = {
    [urlParamNames.kind]: labels.kindField,
    [urlParamNames.word]: labels.wordField,
    [urlParamNames.cols]: labels.sizeField,
    [urlParamNames.difficulty]: labels.difficultyField,
    [urlParamNames.mazeLetterAmount]: labels.mazeLetterAmountField,
    [urlParamNames.seed]: "Seed",
    [urlParamNames.savedSeeds]: "Gespeicherte Seeds",
    [urlParamNames.additionalPuzzle]: "Puzzle",
  };

  return invalidParams
    .map(
      (param) =>
        `${paramLabels[param.name] ?? param.name} (${param.name}=${formatUrlParamValue(param.value)})`,
    )
    .join(", ");
}

function formatUrlParamValue(value: string): string {
  const truncated = value.length > 32 ? `${value.slice(0, 29)}...` : value;
  return truncated.trim().length > 0 ? truncated : JSON.stringify(truncated);
}

function readUrlParam<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  params: URLSearchParams,
  name: string,
  schema: TSchema,
  invalidParams: PuzzleUrlInvalidParam[],
): v.InferOutput<TSchema> | undefined {
  const value = params.get(name);

  if (value === null) {
    return undefined;
  }

  const result = v.safeParse(schema, value);

  if (result.success) {
    return result.output;
  }

  invalidParams.push({ name, value });
  return undefined;
}

function parsePuzzleLanguage(value: string): PuzzleLanguage {
  validatePuzzleLanguage(value);
  return value;
}

function parsePuzzleKind(value: string): PuzzleKind {
  validatePuzzleKind(value);
  return value;
}

function parseDifficulty(value: string): Difficulty {
  validateDifficulty(value);
  return value;
}

function parseMazeLetterAmount(value: string): MazeLetterAmount {
  validateMazeLetterAmount(value);
  return value;
}

function renderWorksheetMeta(puzzle: Puzzle, title: string): string {
  const labels = languageConfigs[puzzle.language].labels;
  const base = `${title} · ${puzzle.cols} × ${puzzle.rows} · ${labels.difficulties[puzzle.difficulty]}`;

  if (puzzle.kind === "maze") {
    return `${base} · ${labels.lettersMeta}: ${labels.mazeLetterAmounts[puzzle.mazeLetterAmount]}`;
  }

  return `${base} · ${labels.wordMeta}: ${puzzle.word}`;
}

function renderPuzzlePagesHtml(
  puzzles: readonly Puzzle[],
  options: {
    showSolution: boolean;
    showDeleteButtons?: boolean;
    showDemoBadge?: boolean;
    printSourceUrl?: string;
  },
): string {
  return puzzles
    .map((puzzle, index) => {
      const labels = languageConfigs[puzzle.language].labels;
      const title = labels.puzzleKinds[puzzle.kind];
      const demoBadge =
        index === 0 && options.showDemoBadge
          ? `<span class="demo-badge">${escapeHtml(labels.demo)}</span>`
          : "";
      const deleteButton = options.showDeleteButtons
        ? `<button class="delete-puzzle" type="button" data-puzzle-index="${index}" aria-label="${escapeHtml(labels.deletePuzzle(index + 1))}" title="${escapeHtml(labels.deletePuzzle(index + 1))}"><span aria-hidden="true">×</span></button>`
        : "";
      const printSource = options.printSourceUrl
        ? `<div class="print-source">${escapeHtml(labels.printSource)} ${escapeHtml(options.printSourceUrl)}</div>`
        : "";

      return `
        <section class="print-page">
          <header class="sheet-header">
            <div class="sheet-heading">
              ${demoBadge}
              <h1 class="print-title">${escapeHtml(title)}</h1>
            </div>
            <div class="worksheet-meta">${escapeHtml(renderWorksheetMeta(puzzle, title))}</div>
            ${deleteButton}
          </header>
          <div class="print-fields" aria-hidden="true">
            <span>${escapeHtml(labels.name)}</span>
            <span>${escapeHtml(labels.date)}</span>
          </div>
          <div class="print-worksheet">${renderSvg(puzzle, { showSolution: options.showSolution })}</div>
          <div class="answer-boxes" aria-hidden="true">${renderAnswerBoxesHtml(puzzle)}</div>
          ${printSource}
        </section>
      `;
    })
    .join("");
}

export function renderPrintablePuzzlesHtml(
  puzzles: readonly Puzzle[],
  printSourceUrl?: string,
): string {
  return renderPuzzlePagesHtml(
    puzzles,
    printSourceUrl ? { showSolution: false, printSourceUrl } : { showSolution: false },
  );
}

export function renderInteractivePuzzlesHtml(
  puzzles: readonly Puzzle[],
  options: { showSolution: boolean; showDemoBadge: boolean; printSourceUrl: string },
): string {
  return renderPuzzlePagesHtml(puzzles, {
    showSolution: options.showSolution,
    showDeleteButtons: true,
    showDemoBadge: options.showDemoBadge,
    printSourceUrl: options.printSourceUrl,
  });
}

export function renderAnswerBoxesHtml(puzzle: Puzzle): string {
  if (puzzle.kind !== "maze") {
    return "";
  }

  const labels = languageConfigs[puzzle.language].labels;

  return `
    <div class="answer-boxes-label">${escapeHtml(labels.answerWord)}</div>
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
