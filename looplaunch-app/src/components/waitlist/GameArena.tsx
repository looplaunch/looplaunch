"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { holdSmoothScroll } from "@/lib/smooth-scroll";
import type { FinishedRun, Status } from "@/lib/waitlist/snake";
import { createLiveClock } from "./live-clock";
import { Leaderboard, type YouRow } from "./Leaderboard";
import { SnakeBoard } from "./SnakeBoard";
import { ClaimCard, DoneCard } from "./GameCards";
import { useWaitlistGame } from "./WaitlistGame";

// Long enough to see the finish (the ring, the confetti, the time locking in) before the form.
const FINISH_PAUSE_MS = 1100;

const touchQuery = "(hover: none), (pointer: coarse)";
const subscribeTouch = (onChange: () => void) => {
  const query = matchMedia(touchQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Loopy's snake, full screen over the waitlist page: the board (or the form after a run) beside
 * the leaderboard. The page behind is inert while it's open.
 */
export function GameArena() {
  const game = useWaitlistGame();
  const { arena, board, boardStatus, me, signedInEmail } = game;
  const [clock] = useState(createLiveClock);
  const [runStatus, setRunStatus] = useState<Status>("ready");
  const touch = useSyncExternalStore(subscribeTouch, () => matchMedia(touchQuery).matches, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { close, saveRun, showClaim } = game;

  // While open: no page scroll behind, focus inside, and back on the button that opened it after.
  useEffect(() => {
    if (!arena.open) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    holdSmoothScroll(true);
    return () => {
      root.style.overflow = overflow;
      holdSmoothScroll(false);
      opener?.focus?.({ preventScroll: true });
    };
  }, [arena.open]);

  // Escape closes the form screens; on the board it pauses first (the board handles that).
  useEffect(() => {
    if (!arena.open || arena.stage === "game") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arena.open, arena.stage, close]);

  // Keep Tab inside the dialog.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex='0']")].filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(finishTimer.current ?? undefined), []);
  const onFinish = useCallback(
    (run: FinishedRun) => {
      // Saved at once, so closing the game during the pause still leaves the run to claim.
      saveRun(run);
      finishTimer.current = setTimeout(showClaim, FINISH_PAUSE_MS);
    },
    [saveRun, showClaim]
  );

  const mine = me ? { id: me.entryId, bestMs: me.bestMs } : null;
  let you: YouRow | null = null;
  // "This run" when they're racing their own saved best on the board, "You" otherwise.
  const label = me?.bestMs != null ? "This run" : "You";
  if (arena.stage === "game" && (runStatus === "play" || runStatus === "won")) {
    you = { label, ms: runStatus === "won" && arena.run ? arena.run.timeMs : null };
  } else if (arena.stage === "claim" && arena.run) {
    you = { label, ms: arena.run.timeMs };
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {arena.open && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Loopy's snake: play to join the waitlist"
            onKeyDown={trapTab}
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-bg-primary text-text-primary"
          >
            <header className="mx-auto flex h-16 w-full max-w-[1140px] items-center justify-between px-4 sm:px-6">
              <Image src="/logo.png" alt="Loop Launch" width={120} height={40} className="h-7 w-auto object-contain" />
              <button
                type="button"
                onClick={close}
                aria-label="Close the game"
                className="grid h-11 w-11 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current stroke-2" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </header>

            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              className="mx-auto flex w-full max-w-[1140px] flex-col gap-6 px-4 pb-8 sm:px-6 lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:gap-10 lg:pb-6"
            >
              <div className="flex flex-col lg:min-h-0">
                {arena.stage === "game" && (
                  <SnakeBoard
                    clock={clock}
                    target={board?.top[0]?.timeMs ?? null}
                    touch={touch}
                    onStatus={setRunStatus}
                    onFinish={onFinish}
                    onSkip={game.skip}
                    onEscape={close}
                  />
                )}
                {arena.stage === "claim" && (
                  <div className="flex flex-1 items-start justify-center lg:items-center">
                    <ClaimCard
                      run={arena.run}
                      board={board}
                      me={me}
                      signedInEmail={signedInEmail}
                      draftName={game.draftName}
                      onJoined={game.joined}
                      onPlayAgain={game.playAgain}
                      onClose={close}
                    />
                  </div>
                )}
                {arena.stage === "done" && arena.result && (
                  <div className="flex flex-1 items-start justify-center lg:items-center">
                    <DoneCard result={arena.result} me={me} onPlayAgain={game.playAgain} onClose={close} />
                  </div>
                )}
              </div>

              <aside className="lg:min-h-0 lg:overflow-y-auto lg:pb-2" aria-label="Leaderboard">
                <Leaderboard board={board} status={boardStatus} clock={clock} you={you} mine={mine} />
              </aside>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
