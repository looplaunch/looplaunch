"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { LOOPY_SRC } from "./LoopyMascot";

/**
 * A drag-or-tap jigsaw of Loopy shown while the AI is working.
 * Pieces scatter around the board; drop one near its slot (or tap it) and it snaps home.
 */

const GRID = 3;
const PIECES = GRID * GRID;
const MAX_BOARD = 228;
const WIDE_BREAKPOINT = 560;

interface Piece {
  id: number;
  x: number;
  y: number;
  r: number;
  placed: boolean;
}

interface Layout {
  width: number;
  height: number;
  board: number;
  boardX: number;
  boardY: number;
  wide: boolean;
}

interface LoopyPuzzleProps {
  /** Rotating status lines shown under the board while waiting. */
  messages?: string[];
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Loopy is reading your market...",
  "Sizing up the competition...",
  "Sharpening your positioning...",
  "Drafting the playbook...",
];

function computeLayout(width: number): Layout {
  const wide = width >= WIDE_BREAKPOINT;
  const board = Math.min(MAX_BOARD, width - 32);
  const piece = board / GRID;
  const boardX = (width - board) / 2;
  const boardY = 16;
  const height = wide ? board + 32 : board + 32 + piece * 1.6 + 24;
  return { width, height, board, boardX, boardY, wide };
}

function scatter(layout: Layout, count: number): { x: number; y: number; r: number }[] {
  const p = layout.board / GRID;
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    if (layout.wide) {
      // Alternate left / right strips beside the board.
      const left = i % 2 === 0;
      const stripW = layout.boardX - 16;
      const minX = left ? 4 : layout.boardX + layout.board + 12;
      x = minX + Math.random() * Math.max(0, stripW - p);
      y = 4 + Math.random() * Math.max(0, layout.height - p - 8);
    } else {
      // Tray beneath the board.
      const trayTop = layout.boardY + layout.board + 20;
      x = 4 + Math.random() * Math.max(0, layout.width - p - 8);
      y = trayTop + Math.random() * Math.max(0, layout.height - trayTop - p - 4);
    }
    out.push({ x, y, r: Math.random() * 24 - 12 });
  }
  return out;
}

export function LoopyPuzzle({ messages = DEFAULT_MESSAGES, className = "" }: LoopyPuzzleProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const drag = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const placedCount = pieces.filter((p) => p.placed).length;
  const solved = pieces.length === PIECES && placedCount === PIECES;

  const shuffle = useCallback((l: Layout) => {
    const spots = scatter(l, PIECES);
    setPieces(Array.from({ length: PIECES }, (_, id) => ({ id, ...spots[id], placed: false })));
  }, []);

  // Measure container, (re)scatter unplaced pieces on resize.
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (!width || width === lastWidth.current) return;
      lastWidth.current = width;
      const next = computeLayout(width);
      const spots = scatter(next, PIECES);
      setLayout(next);
      setPieces((current) =>
        current.length === 0
          ? Array.from({ length: PIECES }, (_, id) => ({ id, ...spots[id], placed: false }))
          : current.map((pc, i) => (pc.placed ? pc : { ...pc, ...spots[i] }))
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cycle the status line.
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 2800);
    return () => clearInterval(t);
  }, [messages.length]);

  if (!layout) {
    return <div ref={wrapRef} className={`w-full ${className}`} style={{ minHeight: 280 }} />;
  }

  const p = layout.board / GRID;
  const homeOf = (id: number) => ({
    x: layout.boardX + (id % GRID) * p,
    y: layout.boardY + Math.floor(id / GRID) * p,
  });

  const placePiece = (id: number) =>
    setPieces((prev) => prev.map((pc) => (pc.id === id ? { ...pc, placed: true, r: 0 } : pc)));

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, pc: Piece) => {
    if (pc.placed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: pc.id, dx: e.clientX - pc.x, dy: e.clientY - pc.y, sx: e.clientX, sy: e.clientY, moved: false };
    setDragId(pc.id);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
    const x = Math.max(0, Math.min(layout.width - p, e.clientX - d.dx));
    const y = Math.max(0, Math.min(layout.height - p, e.clientY - d.dy));
    setPieces((prev) => prev.map((pc) => (pc.id === d.id ? { ...pc, x, y, r: 0 } : pc)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    if (!d) return;
    const pc = pieces.find((x) => x.id === d.id);
    if (!pc) return;
    const home = homeOf(d.id);
    if (!d.moved || Math.hypot(pc.x - home.x, pc.y - home.y) < p * 0.5) placePiece(d.id);
  };

  const replay = () => {
    shuffle(layout);
    setRound((r) => r + 1);
  };

  return (
    <div ref={wrapRef} className={`w-full flex flex-col items-center ${className}`}>
      <div
        className="relative w-full touch-none select-none"
        style={{ height: layout.height }}
      >
        {/* Board with faint ghost of Loopy */}
        <motion.div
          key={`board-${round}`}
          className="absolute rounded-xl"
          style={{
            left: layout.boardX,
            top: layout.boardY,
            width: layout.board,
            height: layout.board,
            outline: solved ? "1px solid transparent" : "1px dashed #3F3F46",
            outlineOffset: 6,
          }}
          animate={solved && !reduce ? { rotate: [0, -4, 3, -1.5, 0], scale: [1, 1.04, 1.04, 1, 1] } : undefined}
          transition={{ duration: 0.7 }}
        >
          <div
            className="absolute inset-0 rounded-xl opacity-[0.07] grayscale"
            style={{ backgroundImage: `url(${LOOPY_SRC})`, backgroundSize: "100% 100%" }}
          />
          {solved && <div className="absolute -inset-3 rounded-2xl bg-[#FF4FB4]/20 blur-2xl -z-10" />}
        </motion.div>

        {pieces.map((pc) => {
          const home = homeOf(pc.id);
          const x = pc.placed ? home.x : pc.x;
          const y = pc.placed ? home.y : pc.y;
          const isDragging = dragId === pc.id;
          return (
            <button
              key={pc.id}
              type="button"
              aria-label={`Puzzle piece ${pc.id + 1} of ${PIECES}${pc.placed ? ", placed" : ", press to place"}`}
              disabled={pc.placed}
              onPointerDown={(e) => onPointerDown(e, pc)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={(e) => {
                // Keyboard activation (detail === 0) places the piece.
                if (e.detail === 0 && !pc.placed) placePiece(pc.id);
              }}
              className={`absolute left-0 top-0 focus-visible:outline-2 focus-visible:outline-[#F4F4F5] ${
                pc.placed ? "cursor-default" : isDragging ? "cursor-grabbing z-20" : "cursor-grab z-10"
              }`}
              style={{
                width: p,
                height: p,
                transform: `translate(${x}px, ${y}px) rotate(${pc.r}deg) scale(${isDragging ? 1.06 : 1})`,
                transition: isDragging || reduce ? "none" : "transform .45s cubic-bezier(.34,1.56,.64,1), filter .3s",
                backgroundImage: `url(${LOOPY_SRC})`,
                backgroundSize: `${layout.board}px ${layout.board}px`,
                backgroundPosition: `${-(pc.id % GRID) * p}px ${-Math.floor(pc.id / GRID) * p}px`,
                borderRadius: pc.placed ? 0 : 6,
                filter: pc.placed ? "none" : "grayscale(0.85) brightness(0.9)",
                boxShadow: pc.placed ? "none" : isDragging ? "0 10px 24px rgba(0,0,0,.55)" : "0 0 0 1px #27272A",
              }}
            />
          );
        })}
      </div>

      {/* Status line */}
      <div className="mt-3 min-h-[40px] flex flex-col items-center gap-1.5 text-center">
        <AnimatePresence mode="wait">
          {solved ? (
            <motion.div
              key="solved"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <span className="text-sm font-medium text-[#F4F4F5]">There he is! Loopy is still working on it.</span>
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#27272A] hover:border-[#3F3F46] rounded-full px-2.5 py-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Play again
              </button>
            </motion.div>
          ) : (
            <motion.p
              key={`hint-${placedCount === 0}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-[#A1A1AA]"
            >
              {placedCount === 0 ? "Drag or tap the pieces to build Loopy while you wait." : `${placedCount} of ${PIECES} pieces`}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-[11px] font-mono text-[#71717A]"
            aria-live="polite"
          >
            {messages[msgIdx % messages.length]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
