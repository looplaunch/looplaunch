"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TARGET, formatTime } from "@/lib/waitlist/snake";
import type { Board, BoardEntry } from "@/lib/waitlist/types";
import type { LiveClock } from "./live-clock";
import { bestRank, rankOn, type BoardStatus } from "./WaitlistGame";

export interface YouRow {
  label: string;
  /** Null while the run is going: the row follows the clock. */
  ms: number | null;
}

interface LeaderboardProps {
  board: Board | null;
  status: BoardStatus;
  clock: LiveClock;
  you: YouRow | null;
  /** This visitor's saved entry, marked on the board. */
  mine: { id: string | null; bestMs: number | null } | null;
}

type Row = { kind: "entry"; entry: BoardEntry } | { kind: "you" };

/** The panel always lists this many places, so it keeps one size however many have played. */
const SLOTS = 10;
// Calm on purpose: it sits beside the game, so only the run's own row moves, gliding past times.
const GLIDE = { duration: 0.35, ease: [0.22, 1, 0.36, 1] } as const;
const COLS = "grid-cols-[32px_1fr_auto] items-center gap-3 px-3";
const LINE = "border-b border-white/[0.06] last:border-b-0";

/** How many of the board's times a run at `ms` has already gone past. */
function timesPassed(board: Board, ms: number): number {
  let passed = 0;
  while (passed < board.counts.length && board.counts[passed][0] <= ms) passed++;
  return passed;
}

/** The game's side panel: the fastest first names and times, with this run racing them live. */
export function Leaderboard({ board, status, clock, you, mine }: LeaderboardProps) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const live = you !== null && you.ms === null;
  const subscribe = useCallback((onChange: () => void) => clock.subscribe(onChange), [clock]);

  // While the run is going, the panel re-renders only when the clock passes someone's time.
  // The row's own time follows the clock every frame, outside React.
  const passed = useSyncExternalStore(
    subscribe,
    () => (live && board ? timesPassed(board, clock.ms) : 0),
    () => 0
  );
  useEffect(() => {
    if (!live) return;
    return clock.subscribe(() => {
      if (timeRef.current) timeRef.current.textContent = formatTime(clock.ms);
    });
  }, [live, clock]);

  // Everyone at or under this time is ahead of the run. Times on the board are whole moves, so
  // for a live run the last time passed stands in for the clock exactly.
  const aheadUpTo = you?.ms ?? (board && passed > 0 ? board.counts[passed - 1][0] : -1);
  const youRank = board && you ? rankOn(board, aheadUpTo, mine) : 1;

  const rows = useMemo<Row[]>(() => {
    const entries: Row[] = (board?.top ?? []).map((entry) => ({ kind: "entry", entry }));
    if (!you) return entries;
    const at = (board?.top ?? []).filter((entry) => entry.timeMs <= aheadUpTo).length;
    return [...entries.slice(0, at), { kind: "you" }, ...entries.slice(at)];
  }, [board, you, aheadUpTo]);

  const total = board?.total ?? 0;
  const myRank = board && mine ? bestRank(board, { entryId: mine.id, bestMs: mine.bestMs }) : null;
  // Rows are numbered as they'd stand if the run ended now. A run slower than everyone shown sits
  // at the bottom with its real place, past people the panel doesn't list.
  const youBelowShown = rows.at(-1)?.kind === "you" && total > (board?.top.length ?? 0);
  // Empty places below the times, numbered on, so the panel fills its column evenly (desktop only).
  const empty = Array.from({ length: Math.max(0, SLOTS - Math.max(rows.length, 1)) }, (_, i) => Math.max(rows.length, 1) + i + 1);

  return (
    <section
      aria-labelledby="leaderboard-title"
      className="flex h-full flex-col rounded-2xl border border-border-subtle bg-bg-surface p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="leaderboard-title" className="flex items-center gap-2 text-lg font-semibold">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 fill-none stroke-[#A78BFA] stroke-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
          </svg>
          Leaderboard
        </h2>
        {status === "ready" && total > 0 && (
          <p className="text-sm text-text-tertiary">
            {total} {total === 1 ? "player" : "players"}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-text-secondary">Fastest to eat {TARGET} words</p>

      {status === "loading" && (
        <ol className="mt-4 grid min-h-0 flex-1 auto-rows-[minmax(36px,1fr)] gap-1.5" aria-label="Loading the leaderboard">
          {Array.from({ length: SLOTS }, (_, i) => (
            <li key={i} className={`rounded-lg bg-bg-elevated motion-safe:animate-pulse ${i >= 5 ? "hidden lg:block" : ""}`} />
          ))}
        </ol>
      )}

      {status === "unavailable" && (
        <p className="mt-5 rounded-xl bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
          The leaderboard is offline right now. You can still join the waitlist.
        </p>
      )}

      {status === "ready" && (
        <ol className="mt-3 grid min-h-0 flex-1 auto-rows-[minmax(40px,1fr)] lg:auto-rows-[minmax(30px,1fr)] lg:overflow-y-auto">
          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              if (row.kind === "you") {
                return (
                  <motion.li
                    key="you"
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ opacity: { duration: 0.2 }, layout: GLIDE }}
                    className={`grid ${COLS} relative z-10 rounded-xl bg-[#8B5CF6] text-white`}
                  >
                    <span className="font-mono text-sm font-semibold tabular-nums">{youBelowShown ? youRank : i + 1}</span>
                    <span className="truncate font-semibold">{you!.label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {you!.ms === null ? <span ref={timeRef}>{formatTime(clock.ms)}</span> : formatTime(you!.ms)}
                    </span>
                  </motion.li>
                );
              }
              const place = i + 1;
              const isMine = row.entry.id === mine?.id;
              return (
                <motion.li
                  key={row.entry.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ opacity: { duration: 0.25 }, layout: GLIDE }}
                  className={`grid ${COLS} ${LINE}`}
                >
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      place === 1 ? "font-semibold text-[#A78BFA]" : place <= 3 ? "text-text-primary" : "text-text-tertiary"
                    }`}
                  >
                    {place}
                  </span>
                  <span className={`truncate ${isMine ? "font-semibold text-white" : "text-text-primary"}`}>
                    {row.entry.name}
                    {isMine && <span className="ml-1.5 text-xs font-normal text-[#A78BFA]">you</span>}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-text-secondary">{formatTime(row.entry.timeMs)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {rows.length === 0 && (
            <li className={`grid ${COLS} ${LINE}`}>
              <span className="font-mono text-sm tabular-nums text-text-tertiary">1</span>
              <span className="truncate text-sm text-text-secondary">No times yet. Finish a run to take first place.</span>
            </li>
          )}
          {empty.map((place) => (
            <li key={`empty-${place}`} aria-hidden="true" className={`hidden lg:grid ${COLS} ${LINE}`}>
              <span className="font-mono text-sm tabular-nums text-[#3F3F48]">{place}</span>
              <span className="text-[#3F3F48]">—</span>
            </li>
          ))}
        </ol>
      )}

      {myRank !== null && mine?.bestMs != null && (
        <p className="mt-3 border-t border-white/[0.06] pt-4 text-sm text-text-secondary">
          Your best: <span className="font-mono text-text-primary">{formatTime(mine.bestMs)}</span>, #{myRank} on the
          board
        </p>
      )}
    </section>
  );
}
