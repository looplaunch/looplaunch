"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { FinishedRun } from "@/lib/waitlist/snake";
import type { Board, JoinResponse } from "@/lib/waitlist/types";
import { track } from "@/lib/analytics";
import { parseMe, readMe, readMeOnServer, saveMe, subscribeMe, type Me } from "./me";

export type Stage = "game" | "claim" | "done";
export type BoardStatus = "loading" | "ready" | "unavailable";

interface Arena {
  open: boolean;
  stage: Stage;
  /** A finished run that isn't saved yet. It survives closing the game, so it can still be claimed. */
  run: FinishedRun | null;
  result: JoinResponse | null;
}

interface WaitlistGameValue {
  board: Board | null;
  boardStatus: BoardStatus;
  me: Me | null;
  signedInEmail: string | null;
  arena: Arena;
  /** A first name typed on the page before the game opened; the join form starts with it. */
  draftName: string;
  setDraftName(name: string): void;
  openGame(): void;
  /** Straight to the form, without playing. */
  openJoin(): void;
  close(): void;
  saveRun(run: FinishedRun): void;
  showClaim(): void;
  skip(): void;
  playAgain(): void;
  joined(result: JoinResponse, email: string): void;
}

const WaitlistGameContext = createContext<WaitlistGameValue | null>(null);

export function useWaitlistGame(): WaitlistGameValue {
  const value = useContext(WaitlistGameContext);
  if (!value) throw new Error("useWaitlistGame needs a WaitlistGameProvider");
  return value;
}

// The board is fetched on page load and again when the game opens, if it's older than this.
const BOARD_FRESH_MS = 15_000;

/** The waitlist page's shared state: the leaderboard, this visitor's entry, and the game's stage. */
export function WaitlistGameProvider({
  signedInEmail = null,
  children,
}: {
  signedInEmail?: string | null;
  children: ReactNode;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardStatus, setBoardStatus] = useState<BoardStatus>("loading");
  const [arena, setArena] = useState<Arena>({ open: false, stage: "game", run: null, result: null });
  const [draftName, setDraftName] = useState("");
  const fetchedAt = useRef(0);
  const meRaw = useSyncExternalStore(subscribeMe, readMe, readMeOnServer);
  const me = useMemo(() => parseMe(meRaw), [meRaw]);

  const loadBoard = useCallback(() => {
    fetchedAt.current = Date.now();
    fetch("/api/waitlist/leaderboard", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { board: null }))
      .then((data: { board: Board | null }) => {
        setBoard(data.board);
        setBoardStatus(data.board ? "ready" : "unavailable");
      })
      .catch(() => setBoardStatus((status) => (status === "ready" ? status : "unavailable")));
  }, []);

  useEffect(loadBoard, [loadBoard]);

  const openGame = useCallback(() => {
    if (Date.now() - fetchedAt.current > BOARD_FRESH_MS) loadBoard();
    setArena((a) => ({ ...a, open: true, stage: a.run ? "claim" : "game", result: null }));
  }, [loadBoard]);

  const openJoin = useCallback(() => {
    track("waitlist_skip_game");
    setArena({ open: true, stage: "claim", run: null, result: null });
  }, []);

  const close = useCallback(() => {
    setArena((a) => ({ ...a, open: false, stage: a.stage === "done" ? "game" : a.stage, result: null }));
  }, []);

  const saveRun = useCallback((run: FinishedRun) => setArena((a) => ({ ...a, run })), []);
  const showClaim = useCallback(() => setArena((a) => (a.open && a.run ? { ...a, stage: "claim" } : a)), []);
  const skip = useCallback(() => {
    track("waitlist_skip_game");
    setArena((a) => ({ ...a, stage: "claim", run: null }));
  }, []);
  const playAgain = useCallback(() => setArena((a) => ({ ...a, stage: "game", run: null, result: null })), []);

  const joined = useCallback((result: JoinResponse, email: string) => {
    track("waitlist_join", { method: result.timeMs === null ? "skip" : "game" });
    if (result.entryId || result.board) {
      saveMe({ firstName: result.firstName, email, entryId: result.entryId, bestMs: result.bestMs, rank: result.rank });
    }
    if (result.board) {
      setBoard(result.board);
      setBoardStatus("ready");
    }
    setArena((a) => ({ ...a, stage: "done", run: null, result }));
  }, []);

  const value = useMemo<WaitlistGameValue>(
    () => ({
      board,
      boardStatus,
      me,
      signedInEmail,
      arena,
      draftName,
      setDraftName,
      openGame,
      openJoin,
      close,
      saveRun,
      showClaim,
      skip,
      playAgain,
      joined,
    }),
    [board, boardStatus, me, signedInEmail, arena, draftName, openGame, openJoin, close, saveRun, showClaim, skip, playAgain, joined]
  );

  return <WaitlistGameContext.Provider value={value}>{children}</WaitlistGameContext.Provider>;
}

/**
 * Where this visitor's best stands, 1 for the fastest. Exact while it's in the top few; further
 * down, everyone strictly faster is counted ahead.
 */
export function bestRank(board: Board, me: { entryId: string | null; bestMs: number | null } | null): number | null {
  if (me?.bestMs == null) return null;
  const at = me.entryId ? board.top.findIndex((entry) => entry.id === me.entryId) : -1;
  if (at >= 0) return at + 1;
  let ahead = 0;
  for (const [time, players] of board.counts) {
    if (time >= me.bestMs) break;
    ahead += players;
  }
  return ahead + 1;
}

/** Where a time stands on the board, 1 for the fastest: everyone faster or equal is ahead. */
export function rankOn(board: Board, ms: number, mine?: { id: string | null; bestMs: number | null } | null): number {
  let ahead = 0;
  for (const [time, players] of board.counts) {
    if (time > ms) break;
    ahead += players;
  }
  // Someone racing their own best isn't ahead of themselves.
  if (mine?.bestMs != null && mine.bestMs <= ms) ahead -= 1;
  return Math.max(0, ahead) + 1;
}
