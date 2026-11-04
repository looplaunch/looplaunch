import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DOWN,
  GRID,
  LEFT,
  RIGHT,
  STEP_MS,
  TARGET,
  UP,
  canTurn,
  newGame,
  parseRun,
  queueTurn,
  replay,
  start,
  step,
  type Cell,
  type Dir,
  type SnakeGame,
} from "../snake";

const DIRS: Dir[] = [UP, RIGHT, DOWN, LEFT];
const key = (c: Cell) => c.y * GRID + c.x;
const moved = (c: Cell, d: Dir): Cell => ({
  x: (c.x + [0, 1, 0, -1][d] + GRID) % GRID,
  y: (c.y + [-1, 0, 1, 0][d] + GRID) % GRID,
});

/** A shortest-path bot: the direction of the first move on the shortest way to the food. */
function botDir(game: SnakeGame): Dir {
  const blocked = new Set(game.snake.slice(0, -1).map(key));
  const first = new Map<number, Dir>();
  const queue: Cell[] = [];
  for (const d of DIRS) {
    const next = moved(game.snake[0], d);
    if (blocked.has(key(next)) || first.has(key(next))) continue;
    first.set(key(next), d);
    queue.push(next);
  }
  while (queue.length) {
    const cell = queue.shift()!;
    if (cell.x === game.food.x && cell.y === game.food.y) return first.get(key(cell))!;
    for (const d of DIRS) {
      const next = moved(cell, d);
      if (blocked.has(key(next)) || first.has(key(next))) continue;
      first.set(key(next), first.get(key(cell))!);
      queue.push(next);
    }
  }
  return game.dir;
}

function playWithBot(seed: number): SnakeGame {
  const game = newGame(seed);
  start(game);
  while (game.status === "play" && game.steps < 500) {
    const d = botDir(game);
    if (d !== game.dir) queueTurn(game, d);
    step(game);
  }
  return game;
}

describe("Loopy's snake rules", () => {
  test("a seed always lays out the same food", () => {
    assert.deepEqual(newGame(42).food, newGame(42).food);
    const foods = new Set(Array.from({ length: 50 }, (_, i) => key(newGame(i).food)));
    assert.ok(foods.size > 10, "different seeds give different layouts");
  });

  test("food starts 4 to 7 moves from the head, never on the snake", () => {
    for (let seed = 0; seed < 500; seed++) {
      const game = newGame(seed);
      const head = game.snake[0];
      const dx = Math.min(Math.abs(game.food.x - head.x), GRID - Math.abs(game.food.x - head.x));
      const dy = Math.min(Math.abs(game.food.y - head.y), GRID - Math.abs(game.food.y - head.y));
      assert.ok(dx + dy >= 4 && dx + dy <= 7, `seed ${seed}: distance ${dx + dy}`);
      assert.ok(!game.snake.some((c) => c.x === game.food.x && c.y === game.food.y));
    }
  });

  test("turns: no reversing, a three-key burst is kept, the first key turns at once", () => {
    assert.ok(canTurn(RIGHT, UP) && canTurn(UP, LEFT) && !canTurn(RIGHT, LEFT) && !canTurn(UP, UP));
    const game = newGame(1);
    assert.equal(queueTurn(game, LEFT), false, "can't turn back on himself");
    assert.ok(queueTurn(game, UP) && queueTurn(game, LEFT) && queueTurn(game, DOWN));
    assert.equal(queueTurn(game, RIGHT), false, "at most three buffered");

    const fresh = newGame(1);
    start(fresh, UP);
    step(fresh);
    assert.deepEqual(fresh.snake[0], { x: 4, y: 5 }, "the first move goes up");
    assert.deepEqual(fresh.turns, [[0, UP]]);
  });

  test("edges wrap around", () => {
    const game = newGame(1);
    game.snake = [{ x: GRID - 1, y: 3 }, { x: GRID - 2, y: 3 }, { x: GRID - 3, y: 3 }];
    game.food = { x: 5, y: 9 };
    start(game);
    step(game);
    assert.deepEqual(game.snake[0], { x: 0, y: 3 });
  });

  test("biting his own body ends the run; following his tail doesn't", () => {
    const game = newGame(1);
    game.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }];
    game.food = { x: 11, y: 0 };
    start(game);
    queueTurn(game, DOWN);
    queueTurn(game, LEFT);
    queueTurn(game, UP);
    assert.equal(step(game), "move");
    assert.equal(step(game), "move");
    assert.equal(step(game), "lose");
    assert.equal(game.status, "lost");

    const loop = newGame(1);
    loop.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }];
    loop.food = { x: 11, y: 0 };
    start(loop);
    queueTurn(loop, DOWN);
    assert.equal(step(loop), "move", "the tail moves out of the way");
  });

  test("bot runs finish and replay to the same time, counted in moves", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const game = playWithBot(seed);
      assert.equal(game.status, "won", `seed ${seed} finishes`);
      assert.equal(game.eaten, TARGET);
      assert.ok(game.steps >= 12, "each word is at least 4 moves away");
      const result = replay(seed, game.turns);
      assert.deepEqual(result, { ok: true, steps: game.steps, timeMs: game.steps * STEP_MS }, `seed ${seed}`);
    }
  });

  test("a run that doesn't check out is refused", () => {
    const game = playWithBot(7);
    const turns = game.turns;
    assert.ok(turns.length > 0);

    assert.deepEqual(replay(7, [[0, LEFT], ...turns]), { ok: false, reason: "illegal turn" }, "turning back on himself");
    assert.deepEqual(replay(7, [...turns, [game.steps + 5, UP]]), { ok: false, reason: "unused turns" });
    assert.equal(replay(7, [...turns].reverse()).ok, turns.length === 1, "turns out of order");
    assert.equal(replay(7, []).ok, false, "no turns: he never reaches all three words");
  });

  test("only well-formed runs are read", () => {
    assert.deepEqual(parseRun({ seed: 5, turns: [[0, 1], [3, 2]] }), { seed: 5, turns: [[0, 1], [3, 2]] });
    for (const bad of [
      null,
      "x",
      { seed: -1, turns: [] },
      { seed: 1.5, turns: [] },
      { seed: 2 ** 32, turns: [] },
      { seed: 1, turns: "x" },
      { seed: 1, turns: [[0, 4]] },
      { seed: 1, turns: [[-1, 1]] },
      { seed: 1, turns: [[0.5, 1]] },
      { seed: 1, turns: [[0, 1, 2]] },
      { seed: 1, turns: Array.from({ length: 3001 }, (_, i) => [i, i % 2]) },
    ]) {
      assert.equal(parseRun(bad), null, JSON.stringify(bad)?.slice(0, 60));
    }
  });
});
