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

const ROW_SPRING = { type: "spring", stiffness: 520, damping: 42 } as const;

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

  return (
    <section aria-labelledby="leaderboard-title" className="rounded-2xl border border-border-subtle bg-bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="leaderboard-title" className="text-lg font-semibold">
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
        <ol className="mt-5 space-y-2" aria-label="Loading the leaderboard">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="h-10 rounded-lg bg-bg-elevated motion-safe:animate-pulse" />
          ))}
        </ol>
      )}

      {status === "unavailable" && (
        <p className="mt-5 rounded-xl bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
          The leaderboard is offline right now. You can still join the waitlist.
        </p>
      )}

      {status === "ready" && (
        <ol className="mt-4">
          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              if (row.kind === "you") {
                return (
                  <motion.li
                    key="you"
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={ROW_SPRING}
                    className="relative z-10 my-1 grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl bg-[#8B5CF6] px-3 py-2.5 text-white shadow-[0_8px_24px_-12px_rgba(139,92,246,0.9)]"
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
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ROW_SPRING, delay: Math.min(i, 9) * 0.03 }}
                  className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
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
            <li className="rounded-xl bg-bg-elevated px-4 py-4 text-sm text-text-secondary">
              No times yet. Finish a run and you&apos;re first on the board.
            </li>
          )}
        </ol>
      )}

      {myRank !== null && mine?.bestMs != null && (
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-sm text-text-secondary">
          Your best: <span className="font-mono text-text-primary">{formatTime(mine.bestMs)}</span>, #{myRank} on the
          board
        </p>
      )}
    </section>
  );
}
