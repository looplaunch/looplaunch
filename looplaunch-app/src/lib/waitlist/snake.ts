/**
 * Loopy's snake, the game on the waitlist page, as rules only: no drawing, no clock.
 *
 * The page plays it, and the server replays a finished run's turns with this same code before its
 * time can reach the leaderboard, so a time can't be typed in. A time counts moves (STEP_MS each),
 * not the wall clock, so a pause, a slow phone or a dropped frame never changes it.
 */

export const GRID = 12;
export const STEP_MS = 160;
/** Words Loopy eats to finish a run. */
export const TARGET = 3;
/** The longest run the server will replay: 3,000 moves, eight minutes of play. */
export const MAX_STEPS = 3000;

/** 0 up, 1 right, 2 down, 3 left. A turn is legal when one direction is even and the other odd. */
export type Dir = 0 | 1 | 2 | 3;
export const UP: Dir = 0;
export const RIGHT: Dir = 1;
export const DOWN: Dir = 2;
export const LEFT: Dir = 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Cell {
  x: number;
  y: number;
}

/** A turn Loopy made: before move number `step`, he turned to `dir`. */
export type Turn = [step: number, dir: Dir];

export type Status = "ready" | "play" | "won" | "lost";

export interface SnakeGame {
  readonly seed: number;
  /** Head first. */
  snake: Cell[];
  /** Where each segment was before the last move, for drawing the move in between. */
  prev: Cell[];
  dir: Dir;
  /** Turns pressed but not made yet, at most three. */
  queue: Dir[];
  food: Cell;
  eaten: number;
  steps: number;
  status: Status;
  turns: Turn[];
  random: () => number;
}

export interface FinishedRun {
  seed: number;
  turns: Turn[];
  timeMs: number;
}

/** mulberry32: a tiny seeded random number generator, so one seed always lays out the same food. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed: number): SnakeGame {
  const snake = [
    { x: 4, y: 6 },
    { x: 3, y: 6 },
    { x: 2, y: 6 },
  ];
  const game: SnakeGame = {
    seed: seed >>> 0,
    snake,
    prev: snake.map((c) => ({ ...c })),
    dir: RIGHT,
    queue: [],
    food: { x: 0, y: 0 },
    eaten: 0,
    steps: 0,
    status: "ready",
    turns: [],
    random: seeded(seed),
  };
  game.food = placeFood(game);
  return game;
}

const wrapDistance = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, GRID - d);
};

/** Food lands 4 to 7 moves from Loopy's head (the edges wrap) and never on the snake. */
function placeFood(game: SnakeGame): Cell {
  const head = game.snake[0];
  for (let tries = 1; ; tries++) {
    const cell = { x: Math.floor(game.random() * GRID), y: Math.floor(game.random() * GRID) };
    if (game.snake.some((c) => c.x === cell.x && c.y === cell.y)) continue;
    const d = wrapDistance(cell.x, head.x) + wrapDistance(cell.y, head.y);
    if ((d >= 4 && d <= 7) || tries >= 200) return cell;
  }
}

export const canTurn = (from: Dir, to: Dir) => (from + to) % 2 === 1;

/** Start the clock. Loopy sets off right, or turns on his first move if the first key says so. */
export function start(game: SnakeGame, dir?: Dir) {
  if (game.status !== "ready") return;
  game.status = "play";
  if (dir !== undefined) queueTurn(game, dir);
}

/** Buffer a turn for the coming moves, so quick presses between two moves aren't lost. */
export function queueTurn(game: SnakeGame, dir: Dir): boolean {
  const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  if (game.queue.length >= 3 || !canTurn(last, dir)) return false;
  game.queue.push(dir);
  return true;
}

export type StepResult = "move" | "eat" | "win" | "lose";

/** One move, after making at most one buffered turn. */
export function step(game: SnakeGame): StepResult | null {
  if (game.status !== "play") return null;
  while (game.queue.length) {
    const dir = game.queue.shift()!;
    if (canTurn(game.dir, dir)) {
      game.dir = dir;
      game.turns.push([game.steps, dir]);
      break;
    }
  }

  game.prev = game.snake.map((c) => ({ ...c }));
  const head = {
    x: (game.snake[0].x + DX[game.dir] + GRID) % GRID,
    y: (game.snake[0].y + DY[game.dir] + GRID) % GRID,
  };
  // The tail leaves its cell on this move, so the head may move into it.
  if (game.snake.some((c, i) => i < game.snake.length - 1 && c.x === head.x && c.y === head.y)) {
    game.status = "lost";
    return "lose";
  }

  game.snake.unshift(head);
  game.steps++;
  if (head.x === game.food.x && head.y === game.food.y) {
    game.eaten++;
    // The new segment grows out of the tail, so it starts where the tail was.
    game.prev.push({ ...game.prev[game.prev.length - 1] });
    if (game.eaten >= TARGET) {
      game.status = "won";
      return "win";
    }
    game.food = placeFood(game);
    return "eat";
  }
  game.snake.pop();
  return "move";
}

export type ReplayResult = { ok: true; steps: number; timeMs: number } | { ok: false; reason: string };

/** Play a run again from its seed and turns. Only a run that eats TARGET words, using every turn, counts. */
export function replay(seed: number, turns: readonly Turn[]): ReplayResult {
  const game = newGame(seed);
  game.status = "play";
  let next = 0;
  while (game.status === "play") {
    if (game.steps >= MAX_STEPS) return { ok: false, reason: "too long" };
    const turn = turns[next];
    if (turn && turn[0] === game.steps) {
      if (!canTurn(game.dir, turn[1])) return { ok: false, reason: "illegal turn" };
      game.queue = [turn[1]];
      next++;
    }
    step(game);
  }
  if (game.status !== "won") return { ok: false, reason: "did not finish" };
  if (next !== turns.length) return { ok: false, reason: "unused turns" };
  return { ok: true, steps: game.steps, timeMs: game.steps * STEP_MS };
}

/** A run as the page sends it, or null when it isn't one. */
export function parseRun(input: unknown): { seed: number; turns: Turn[] } | null {
  if (!input || typeof input !== "object") return null;
  const { seed, turns } = input as { seed?: unknown; turns?: unknown };
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  if (!Array.isArray(turns) || turns.length > MAX_STEPS) return null;
  const parsed: Turn[] = [];
  for (const turn of turns) {
    if (!Array.isArray(turn) || turn.length !== 2) return null;
    const [at, dir] = turn as unknown[];
    if (typeof at !== "number" || !Number.isInteger(at) || at < 0 || at >= MAX_STEPS) return null;
    if (dir !== 0 && dir !== 1 && dir !== 2 && dir !== 3) return null;
    parsed.push([at, dir]);
  }
  return { seed, turns: parsed };
}

/** 2400 → "2.40s". Times are whole moves of 160 ms, so two decimals show them exactly. */
export function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
