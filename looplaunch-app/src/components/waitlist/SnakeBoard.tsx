"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  DOWN,
  GRID,
  LEFT,
  RIGHT,
  STEP_MS,
  TARGET,
  UP,
  formatTime,
  newGame,
  queueTurn,
  start,
  step,
  type Cell,
  type Dir,
  type FinishedRun,
  type SnakeGame,
  type Status,
  type StepResult,
} from "@/lib/waitlist/snake";
import { track } from "@/lib/analytics";
import type { LiveClock } from "./live-clock";

// The things Loop Launch makes, as Loopy's food.
const WORDS = ["VIRTUAL CMO", "STRATEGY", "MIND MAP", "WEEK PLAN", "STOP", "START", "HOOKS", "SCRIPTS", "COMPETITORS", "LOOPY", "OFFER", "REELS", "WHATSAPP"];
const CHEERS = ["Nice", "Yum", "Got it", "Tasty"];
const KEYS: Record<string, Dir> = {
  ArrowUp: UP, ArrowRight: RIGHT, ArrowDown: DOWN, ArrowLeft: LEFT,
  w: UP, d: RIGHT, s: DOWN, a: LEFT, W: UP, D: RIGHT, S: DOWN, A: LEFT,
};
const HEAD_SRC = "/loopy-cutout.webp";
const HEAD_RATIO = 283 / 360;
const COLOR = {
  dot: "#1F1F24",
  food: "#8B5CF6",
  body: "#EDEDEF",
  body2: "#CFCFD4",
  label: "rgba(9, 9, 11, 0.88)",
  labelLine: "#3F3F46",
  text: "#F4F4F5",
};
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
// The game's header bar, above this component (GameArena's h-16)
const HEADER_PX = 64;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  color: string;
}

/** Drawing state that changes every frame, kept out of React. */
interface Fx {
  cell: number;
  size: number;
  lastStep: number;
  paused: boolean;
  pausedFor: number;
  foodBorn: number;
  bump: number;
  ring: number;
  ang: number;
  flip: number;
  facing: number;
  parts: Particle[];
  word: string;
  reduced: boolean;
  mono: string;
}

interface View {
  status: Status;
  eaten: number;
  paused: boolean;
}

interface SnakeBoardProps {
  clock: LiveClock;
  /** The time to beat (the board's fastest), shown under the clock. */
  target: number | null;
  touch: boolean;
  onStatus(status: Status): void;
  onFinish(run: FinishedRun): void;
  onSkip(): void;
  onEscape(): void;
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** Where a segment is drawn this frame, between its last cell and its new one. Two spots while it crosses an edge. */
function spots(a: Cell, b: Cell, e: number): Cell[] {
  let bx = b.x;
  let by = b.y;
  if (Math.abs(a.x - b.x) > 1) bx = b.x > a.x ? b.x - GRID : b.x + GRID;
  if (Math.abs(a.y - b.y) > 1) by = b.y > a.y ? b.y - GRID : b.y + GRID;
  const x = a.x + (bx - a.x) * e;
  const y = a.y + (by - a.y) * e;
  const out = [{ x, y }];
  if (x < 0 || x > GRID - 1) out.push({ x: x < 0 ? x + GRID : x - GRID, y });
  if (y < 0 || y > GRID - 1) out.push({ x, y: y < 0 ? y + GRID : y - GRID });
  return out;
}

function roundRect(cx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  cx.beginPath();
  if (cx.roundRect) cx.roundRect(x, y, w, h, r);
  else cx.rect(x, y, w, h);
}

function draw(cx: CanvasRenderingContext2D, game: SnakeGame, fx: Fx, head: HTMLImageElement, t: number) {
  const { cell, size } = fx;
  cx.clearRect(0, 0, size, size);
  cx.fillStyle = COLOR.dot;
  for (let x = 1; x < GRID; x++) for (let y = 1; y < GRID; y++) cx.fillRect(x * cell - 1, y * cell - 1, 2, 2);

  const moving = game.status === "play" && !fx.paused;
  const e = fx.reduced || !moving ? 1 : Math.min(1, (t - fx.lastStep) / STEP_MS);

  // Food pops in, then breathes so it's easy to find.
  if (game.status !== "won") {
    const age = fx.reduced ? 1 : Math.min(1, (t - fx.foodBorn) / 220);
    const pop = age < 1 ? (1 - Math.pow(1 - age, 3)) * 1.12 - (age > 0.8 ? (age - 0.8) * 0.6 : 0) : 1;
    const breathe = fx.reduced ? 1 : 1 + 0.05 * Math.sin(t / 260);
    const w = (cell - 8) * pop * (age < 1 ? 1 : breathe);
    const fx0 = (game.food.x + 0.5) * cell;
    const fy0 = (game.food.y + 0.5) * cell;
    cx.fillStyle = COLOR.food;
    roundRect(cx, fx0 - w / 2, fy0 - w / 2, w, w, 4);
    cx.fill();

    const fontSize = Math.max(10, Math.round(cell * 0.36));
    cx.font = `600 ${fontSize}px ${fx.mono}`;
    cx.textAlign = "center";
    const onTop = game.food.y === 0;
    cx.textBaseline = onTop ? "top" : "bottom";
    const half = cx.measureText(fx.word).width / 2 + 6;
    const lx = Math.min(Math.max(fx0, half + 2), size - half - 2);
    const ly = onTop ? cell + 4 : game.food.y * cell - 4;
    cx.globalAlpha = age;
    cx.fillStyle = COLOR.label;
    roundRect(cx, lx - half, onTop ? ly - 3 : ly - fontSize - 5, half * 2, fontSize + 8, 5);
    cx.fill();
    cx.strokeStyle = COLOR.labelLine;
    cx.lineWidth = 1;
    cx.stroke();
    cx.fillStyle = COLOR.text;
    cx.fillText(fx.word, lx, onTop ? ly + 1 : ly - 1);
    cx.globalAlpha = 1;
  }

  // Body, tail first, a little thinner towards the tail.
  for (let i = game.snake.length - 1; i > 0; i--) {
    const s = cell - 6 - (i / game.snake.length) * 3;
    cx.fillStyle = i % 2 ? COLOR.body : COLOR.body2;
    for (const p of spots(game.prev[i] ?? game.snake[i], game.snake[i], e)) {
      roundRect(cx, (p.x + 0.5) * cell - s / 2, (p.y + 0.5) * cell - s / 2, s, s, 5);
      cx.fill();
    }
  }

  // Crumbs and confetti
  fx.parts = fx.parts.filter((p) => t - p.born < p.life);
  for (const p of fx.parts) {
    const q = (t - p.born) / p.life;
    const d = cell * (0.4 + q * 1.4);
    cx.globalAlpha = 1 - q;
    cx.fillStyle = p.color;
    cx.fillRect(p.x + p.vx * d - p.size / 2, p.y + p.vy * d - p.size / 2 + q * q * cell * 0.8, p.size, p.size);
  }
  cx.globalAlpha = 1;

  // The finish: a ring opens out from Loopy.
  if (fx.ring && !fx.reduced) {
    const q = Math.min(1, (t - fx.ring) / 700);
    const h0 = game.snake[0];
    cx.globalAlpha = 1 - q;
    cx.strokeStyle = COLOR.food;
    cx.lineWidth = 3;
    cx.beginPath();
    cx.arc((h0.x + 0.5) * cell, (h0.y + 0.5) * cell, cell * (0.6 + q * 4), 0, Math.PI * 2);
    cx.stroke();
    cx.globalAlpha = 1;
  }

  // Loopy's head: bumps when he eats, tilts up and down, turns to face left or right.
  const bq = fx.reduced ? 1 : Math.min(1, (t - fx.bump) / 240);
  const scale = 1 + 0.22 * Math.sin(Math.PI * bq) * (bq < 1 ? 1 : 0);
  const hs = cell * 1.75 * scale;
  const hw = hs * HEAD_RATIO;
  if (DX[game.dir] !== 0) fx.facing = DX[game.dir];
  fx.ang += (DY[game.dir] * 14 - fx.ang) * (fx.reduced ? 1 : 0.18);
  fx.flip += (fx.facing - fx.flip) * (fx.reduced ? 1 : 0.25);
  const flip = Math.abs(fx.flip) < 0.15 ? 0.15 * (Math.sign(fx.flip) || 1) : fx.flip;
  for (const p of spots(game.prev[0], game.snake[0], e)) {
    const x = (p.x + 0.5) * cell;
    const y = (p.y + 0.5) * cell;
    if (head.complete && head.naturalWidth) {
      cx.save();
      cx.translate(x, y);
      cx.rotate(((fx.ang * Math.PI) / 180) * (flip < 0 ? -1 : 1));
      cx.scale(flip, 1);
      cx.drawImage(head, -hw / 2, -hs * 0.6, hw, hs);
      cx.restore();
    } else {
      cx.fillStyle = "#FFFFFF";
      roundRect(cx, x - cell / 2 + 2, y - cell / 2 + 2, cell - 4, cell - 4, 6);
      cx.fill();
    }
  }
}

/**
 * Loopy's snake: the board, its clock and its controls. Arrow keys or WASD, swipes or the pad on
 * phones. The clock starts with the first move. Rules and timing live in src/lib/waitlist/snake.ts.
 */
export function SnakeBoard({ clock, target, touch, onStatus, onFinish, onSkip, onEscape }: SnakeBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const controls = useRef<{ turn(dir: Dir): void; tap(): void } | null>(null);
  const handlers = useRef({ onStatus, onFinish, onEscape });
  const reduced = useReducedMotion() ?? false;
  const reducedRef = useRef(reduced);
  const [view, setView] = useState<View>({ status: "ready", eaten: 0, paused: false });

  useEffect(() => {
    handlers.current = { onStatus, onFinish, onEscape };
    reducedRef.current = reduced;
  });

  useEffect(() => {
    const root = rootRef.current!;
    const hud = hudRef.current!;
    const below = belowRef.current!;
    const frame = frameRef.current!;
    const canvas = canvasRef.current!;
    const layer = layerRef.current!;
    const cx = canvas.getContext("2d")!;
    const head = new Image();
    head.src = HEAD_SRC;
    const mono =
      getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";

    let game = newGame(randomSeed());
    let wordAt = Math.floor(Math.random() * WORDS.length);
    const fx: Fx = {
      cell: 24,
      size: 0,
      lastStep: 0,
      paused: false,
      pausedFor: 0,
      foodBorn: performance.now(),
      bump: 0,
      ring: 0,
      ang: 0,
      flip: 1,
      facing: 1,
      parts: [],
      word: WORDS[wordAt % WORDS.length],
      reduced: reducedRef.current,
      mono,
    };
    const patch = (next: Partial<View>) => setView((v) => ({ ...v, ...next }));
    const showTime = (ms: number) => {
      if (timerRef.current) timerRef.current.textContent = (ms / 1000).toFixed(2);
    };

    // The board takes the room the screen has, in whole cells: the column's width, and the window's
    // height less the header, the clock above the board and the controls below it.
    const resize = () => {
      const room = window.innerHeight - HEADER_PX - hud.offsetHeight - below.offsetHeight - 40;
      const cell = Math.max(16, Math.floor(Math.min(root.clientWidth, room, 576) / GRID));
      const size = cell * GRID;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (size === fx.size && canvas.width === size * dpr) return;
      fx.cell = cell;
      fx.size = size;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      root.style.setProperty("--board", `${size}px`);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    window.addEventListener("resize", resize);
    resize();

    const elapsed = (t: number) =>
      game.steps * STEP_MS +
      (game.status !== "play" ? 0 : fx.paused ? fx.pausedFor : Math.min(STEP_MS - 1, Math.max(0, t - fx.lastStep)));

    const begin = (dir?: Dir) => {
      start(game, dir);
      fx.lastStep = performance.now();
      patch({ status: "play", paused: false });
      handlers.current.onStatus("play");
      track("game_start");
    };
    const reset = () => {
      game = newGame(randomSeed());
      wordAt = Math.floor(Math.random() * WORDS.length);
      Object.assign(fx, { parts: [], ring: 0, paused: false, foodBorn: performance.now(), word: WORDS[wordAt % WORDS.length] });
      showTime(0);
      clock.set(0, false);
      patch({ status: "ready", eaten: 0, paused: false });
      handlers.current.onStatus("ready");
    };
    const pause = () => {
      if (game.status !== "play" || fx.paused) return;
      fx.paused = true;
      fx.pausedFor = Math.min(STEP_MS - 1, performance.now() - fx.lastStep);
      patch({ paused: true });
    };
    const resume = () => {
      if (!fx.paused) return;
      fx.paused = false;
      fx.lastStep = performance.now() - fx.pausedFor;
      patch({ paused: false });
    };
    const turn = (dir: Dir) => {
      if (game.status === "won") return;
      if (game.status === "lost") reset();
      if (game.status === "ready") return begin(dir);
      resume();
      queueTurn(game, dir);
    };
    const tap = () => {
      if (game.status === "ready") begin();
      else if (game.status === "lost") reset();
      else if (fx.paused) resume();
    };
    controls.current = { turn, tap };

    const burst = (at: Cell, t: number, count: number, life: number) => {
      if (fx.reduced) return;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = count > 8 ? 0.8 + Math.random() * 1.6 : 1;
        fx.parts.push({
          x: (at.x + 0.5) * fx.cell,
          y: (at.y + 0.5) * fx.cell,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          born: t,
          life,
          size: count > 8 ? 5 : 4,
          color: i % 2 ? COLOR.food : COLOR.body,
        });
      }
    };
    const cheer = (at: Cell, word: string) => {
      if (fx.reduced) return;
      const label = document.createElement("span");
      label.className =
        "pointer-events-none absolute whitespace-nowrap rounded-md bg-[#8B5CF6] px-2 py-1 font-mono text-[12px] font-semibold tracking-[0.08em] text-white";
      label.textContent = `${CHEERS[(game.eaten - 1) % CHEERS.length]} +${word}`;
      label.style.top = `${at.y * fx.cell}px`;
      layer.appendChild(label);
      const half = label.offsetWidth / 2 + 4;
      label.style.left = `${Math.min(Math.max((at.x + 0.5) * fx.cell, half), fx.size - half)}px`;
      label.animate(
        [
          { opacity: 0, transform: "translate(-50%, -60%) scale(0.8)" },
          { opacity: 1, transform: "translate(-50%, -120%) scale(1)", offset: 0.25 },
          { opacity: 0, transform: "translate(-50%, -220%) scale(1)" },
        ],
        { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      ).onfinish = () => label.remove();
    };
    const buzz = (pattern: number | number[]) => {
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // Some browsers refuse vibration without a gesture; it's only a nicety.
      }
    };

    const afterStep = (result: StepResult | null, t: number, food: Cell, word: string) => {
      if (result === "eat" || result === "win") {
        fx.bump = t;
        burst(food, t, 8, 320);
        cheer(food, word);
        patch({ eaten: game.eaten });
      }
      if (result === "eat") {
        fx.foodBorn = t;
        wordAt++;
        fx.word = WORDS[wordAt % WORDS.length];
        buzz(12);
      }
      if (result === "win") {
        const timeMs = game.steps * STEP_MS;
        fx.ring = t;
        burst(game.snake[0], t, 18, 900);
        buzz([20, 40, 30]);
        showTime(timeMs);
        clock.set(timeMs, false);
        patch({ status: "won" });
        handlers.current.onStatus("won");
        handlers.current.onFinish({ seed: game.seed, turns: game.turns.slice(), timeMs });
        track("game_finish", { time_ms: timeMs });
      }
      if (result === "lose") {
        clock.set(elapsed(t), false);
        patch({ status: "lost" });
        handlers.current.onStatus("lost");
        buzz(60);
        if (!fx.reduced) {
          frame.animate(
            [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
            { duration: 380, easing: "ease-out" }
          );
        }
      }
    };

    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      fx.reduced = reducedRef.current;
      if (game.status === "play" && !fx.paused) {
        let caught = 0;
        while (game.status === "play" && t - fx.lastStep >= STEP_MS) {
          fx.lastStep += STEP_MS;
          // After a long stall, carry on from now rather than rushing the snake to catch up.
          if (++caught > 3) fx.lastStep = t;
          const food = game.food;
          afterStep(step(game), t, food, fx.word);
        }
        if (game.status === "play") {
          const ms = elapsed(t);
          showTime(ms);
          clock.set(ms, true);
        }
      }
      draw(cx, game, fx, head, t);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEYS[e.key];
      if (dir !== undefined) {
        e.preventDefault();
        turn(dir);
        return;
      }
      if (e.repeat) return;
      const onControl = (e.target as Element | null)?.closest?.("button, a, input, textarea, select");
      if ((e.key === " " || e.key === "Enter") && !onControl) {
        e.preventDefault();
        tap();
      } else if (e.key === "p" || e.key === "P") {
        if (fx.paused) resume();
        else pause();
      } else if (e.key === "Escape") {
        if (game.status === "play" && !fx.paused) pause();
        else handlers.current.onEscape();
      }
    };

    // Swipe anywhere while playing. Before the first move, only on the board, so the page can still scroll.
    let swipe: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as Element;
      const onBoard = root.contains(target) && !target.closest("button");
      swipe = game.status === "play" || (onBoard && game.status !== "won") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!swipe) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) {
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
        swipe = { x: t.clientX, y: t.clientY };
      }
    };
    const onTouchEnd = () => {
      swipe = null;
    };
    const onHidden = () => document.visibilityState === "hidden" && pause();

    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    // Read-only state for automated play tests: development builds with ?debug only.
    const debug = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("debug");
    if (debug) {
      (window as unknown as { __snake?: object }).__snake = {
        get state() {
          return { status: game.status, head: game.snake[0], dir: game.dir, food: game.food, body: game.snake, eaten: game.eaten, queue: game.queue.length };
        },
      };
    }

    frame.focus({ preventScroll: true });
    clock.set(0, false);
    handlers.current.onStatus("ready");

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      controls.current = null;
      if (debug) delete (window as unknown as { __snake?: object }).__snake;
    };
  }, [clock]);

  const left = TARGET - view.eaten;
  const hint = touch ? "Swipe or use the pad" : "Arrow keys or WASD";
  const status =
    view.status === "ready"
      ? `${hint} to start the clock`
      : view.status === "won"
        ? `All ${TARGET} eaten`
        : view.status === "lost"
          ? "Bitten. Try again"
          : view.eaten === 0
            ? `Eat ${TARGET} words`
            : `${left} more to go`;

  return (
    <div ref={rootRef} className="flex w-full flex-col items-center lg:flex-1 lg:justify-center">
      {/* What's left to eat, and the clock, as wide as the board */}
      <div ref={hudRef} className="flex w-[var(--board,100%)] max-w-full items-end justify-between gap-4 pb-4">
        <div className="min-w-0">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: TARGET }, (_, i) => (
              <motion.span
                key={i}
                className="block h-4 w-4 rounded-[5px] border"
                animate={
                  i < view.eaten
                    ? { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6", scale: [1, 1.45, 1] }
                    : { backgroundColor: "rgba(139,92,246,0)", borderColor: "#3F3F46", scale: 1 }
                }
                transition={{ duration: 0.35 }}
              />
            ))}
          </div>
          <p
            className={`mt-2 text-sm ${view.status === "ready" ? "font-medium text-text-primary" : "text-text-secondary"}`}
            aria-live="polite"
          >
            {status}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-mono text-[34px] font-semibold leading-none tabular-nums transition-colors duration-300 sm:text-[40px] ${
              view.status === "won" ? "text-[#A78BFA]" : "text-text-primary"
            }`}
          >
            <span ref={timerRef}>0.00</span>
            <span className="ml-0.5 text-[0.5em] text-text-tertiary">s</span>
          </p>
          <p className="mt-1.5 text-xs text-text-tertiary">{target ? `Fastest yet ${formatTime(target)}` : "No times yet"}</p>
        </div>
      </div>

      {/* The board, in whole cells. Its edge pulses until the first move. */}
      <motion.div
        ref={frameRef}
        tabIndex={0}
        role="application"
        aria-label={`Snake board. ${hint} to move; the edges wrap around.`}
        onClick={() => controls.current?.tap()}
        animate={
          view.status === "ready"
            ? { borderColor: ["#27272A", "#8B5CF6", "#27272A"] }
            : { borderColor: "#27272A" }
        }
        transition={view.status === "ready" ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        className="relative shrink-0 rounded-[14px] border bg-[#0C0C0E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40"
        style={{ width: "var(--board, 0px)", height: "var(--board, 0px)", touchAction: "none" }}
      >
        <canvas ref={canvasRef} className="block h-full w-full rounded-[14px]" />
        <div ref={layerRef} className="pointer-events-none absolute inset-0" />

        {view.paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[14px] bg-[#09090B]/80">
            <p className="text-2xl font-semibold tracking-[0.12em]">PAUSED</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                controls.current?.tap();
              }}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
            >
              Resume
            </button>
          </div>
        )}
        {view.status === "lost" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-[#09090B]/85 px-6 text-center"
          >
            <p className="text-3xl font-semibold">Oops</p>
            <p className="text-sm text-text-secondary">Loopy bit his own tail. Shake it off.</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                controls.current?.tap();
              }}
              className="mt-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
            >
              Try again
            </button>
            <p className="text-xs text-text-tertiary">{touch ? "or swipe" : "or press an arrow key"}</p>
          </motion.div>
        )}
        {view.status === "won" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"
          >
            <p className="text-[34px] font-semibold tracking-[0.14em] text-white sm:text-[44px]">DONE</p>
          </motion.div>
        )}
      </motion.div>

      <div ref={belowRef} className="flex w-full flex-col items-center">
        {touch && (
          <div className="mx-auto mt-4 grid grid-cols-[repeat(3,60px)] grid-rows-[repeat(2,54px)] gap-2" aria-label="Direction pad">
            {(
              [
                ["Up", UP, "col-start-2", "M4 13l6-6 6 6"],
                ["Left", LEFT, "col-start-1 row-start-2", "M13 4l-6 6 6 6"],
                ["Down", DOWN, "col-start-2 row-start-2", "M4 7l6 6 6-6"],
                ["Right", RIGHT, "col-start-3 row-start-2", "M7 4l6 6-6 6"],
              ] as const
            ).map(([label, dir, place, path]) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  controls.current?.turn(dir);
                }}
                className={`${place} grid place-items-center rounded-[14px] border border-border-focus bg-bg-surface transition-transform duration-100 active:scale-[0.92] active:border-text-primary active:bg-bg-elevated`}
              >
                <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] fill-none stroke-text-primary stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-1 text-center">
          <p className="text-xs text-text-tertiary">
            {hint} · the edges wrap around{touch ? "" : " · Esc pauses"}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-10 px-2 text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-text-primary"
          >
            Skip the game, just join
          </button>
        </div>
      </div>
    </div>
  );
}
