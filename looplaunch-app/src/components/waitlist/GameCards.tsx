"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { RollingCount } from "@/components/dashboard/RollingCount";
import { FIRST_NAME_MAX, cleanFirstName } from "@/lib/waitlist/names";
import { TARGET, formatTime, type FinishedRun } from "@/lib/waitlist/snake";
import type { Board, JoinResponse } from "@/lib/waitlist/types";
import { bestRank, rankOn } from "./WaitlistGame";
import type { Me } from "./me";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SITE_URL = "https://looplaunch.co";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-6 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#7C3AED] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60";
const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-text-primary transition-colors hover:border-white/40";
const field =
  "mt-2 h-12 w-full rounded-xl border bg-black/40 px-4 text-base text-text-primary placeholder:text-text-placeholder transition-colors focus:border-white";

interface JoinFormProps {
  run: FinishedRun | null;
  defaults: { firstName: string; email: string };
  submitLabel: string;
  onJoined(result: JoinResponse, email: string): void;
}

type Errors = { name?: string; email?: string; form?: string };

/** First name and email. A finished run goes with it, for the server to replay. */
export function JoinForm({ run, defaults, submitLabel, onJoined }: JoinFormProps) {
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [email, setEmail] = useState(defaults.email);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const first = !defaults.firstName ? nameRef.current : !defaults.email ? emailRef.current : submitRef.current;
    const timer = setTimeout(() => first?.focus({ preventScroll: true }), 250);
    return () => clearTimeout(timer);
  }, [defaults.firstName, defaults.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const name = cleanFirstName(firstName);
    const mail = email.trim().toLowerCase();
    const next: Errors = {};
    if (!name) next.name = "Add your first name.";
    if (!mail) next.email = "Add your email.";
    else if (!EMAIL_PATTERN.test(mail)) next.email = "That email doesn't look right.";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.email) return emailRef.current?.focus();

    setSending(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: name,
          email: mail,
          // Joining the waitlist is the request to hear about the launch, so it carries that consent.
          consent: true,
          company: honeypot,
          run: run ? { seed: run.seed, turns: run.turns } : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<JoinResponse> & { error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't save that. Check your connection and try again.");
      onJoined(data as JoinResponse, mail);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't save that. Please try again." });
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 text-left">
      <label className="block">
        <span className="text-sm font-medium text-text-secondary">First name</span>
        <input
          ref={nameRef}
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
          }}
          autoComplete="given-name"
          maxLength={FIRST_NAME_MAX + 10}
          placeholder="Your first name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "join-name-error" : undefined}
          className={`${field} ${errors.name ? "border-white" : "border-white/15"}`}
        />
        {errors.name && (
          <span id="join-name-error" className="mt-1.5 block text-sm text-[#FCA5A5]">
            {errors.name}
          </span>
        )}
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-text-secondary">Email</span>
        <input
          ref={emailRef}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
          }}
          autoComplete="email"
          placeholder="you@brand.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "join-email-error" : undefined}
          className={`${field} ${errors.email ? "border-white" : "border-white/15"}`}
        />
        {errors.email && (
          <span id="join-email-error" className="mt-1.5 block text-sm text-[#FCA5A5]">
            {errors.email}
          </span>
        )}
      </label>

      {/* Honeypot: hidden from people, bots fill it in */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <button ref={submitRef} type="submit" disabled={sending} className={`${primaryButton} mt-6 w-full`}>
        {sending ? "Saving…" : submitLabel}
      </button>
      {errors.form && (
        <p className="mt-3 text-center text-sm text-[#FCA5A5]" role="alert">
          {errors.form}
        </p>
      )}
    </form>
  );
}

interface ClaimCardProps {
  run: FinishedRun | null;
  board: Board | null;
  me: Me | null;
  signedInEmail: string | null;
  draftName?: string;
  onJoined(result: JoinResponse, email: string): void;
  onPlayAgain(): void;
  onClose(): void;
}

/** After a finished run (or a skip): the form that puts someone on the waitlist and their time on the board. */
export function ClaimCard({ run, board, me, signedInEmail, draftName = "", onJoined, onPlayAgain, onClose }: ClaimCardProps) {
  const defaults = { firstName: me?.firstName ?? draftName, email: me?.email ?? signedInEmail ?? "" };

  if (!run) {
    return (
      <Card>
        <h2 className="text-3xl font-semibold tracking-tight">Join the waitlist</h2>
        <p className="mt-2 text-text-secondary">Get in first. We&apos;ll email you when your access is ready.</p>
        <JoinForm run={null} defaults={defaults} submitLabel="Join the waitlist" onJoined={onJoined} />
        <p className="mt-6 text-sm text-text-secondary">
          Rather earn a spot on the board?{" "}
          <button type="button" onClick={onPlayAgain} className="text-text-primary underline underline-offset-4">
            Play Loopy&apos;s snake
          </button>
        </p>
      </Card>
    );
  }

  const mine = me ? { id: me.entryId, bestMs: me.bestMs } : null;
  const rank = board ? rankOn(board, run.timeMs, mine) : null;
  const players = board ? board.total + (me?.bestMs != null ? 0 : 1) : 0;
  const notBetter = me?.bestMs != null && run.timeMs >= me.bestMs;
  const standing = !board
    ? null
    : board.total === 0
      ? "That makes you first on the board."
      : rank === 1
        ? "That's the fastest time yet."
        : `That puts you #${rank} of ${players}.`;

  return (
    <Card>
      <p className="text-sm font-medium text-[#A78BFA]">You ate all {TARGET} words</p>
      <motion.p
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        className="mt-3 font-mono text-[56px] font-semibold leading-none tabular-nums sm:text-[68px]"
      >
        {(run.timeMs / 1000).toFixed(2)}
        <span className="ml-1 text-[0.4em] text-text-tertiary">s</span>
      </motion.p>

      {notBetter ? (
        <>
          <p className="mt-4 text-text-secondary">
            Your best is still <span className="font-mono text-text-primary">{formatTime(me!.bestMs!)}</span>
            {board ? `, #${bestRank(board, me)} on the board` : ""}. You&apos;re already on the waitlist.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onPlayAgain} className={primaryButton}>
              Play again
            </button>
            <button type="button" onClick={onClose} className={ghostButton}>
              Back to the site
            </button>
          </div>
        </>
      ) : (
        <>
          {standing && <p className="mt-4 text-text-secondary">{standing}</p>}
          <h2 className="mt-8 text-2xl font-semibold tracking-tight">
            {!me ? "Claim your spot" : me.bestMs != null ? "Save your new best" : "Put it on the board"}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {!me
              ? "Add your name and email to join the waitlist and put this time on the board."
              : me.bestMs != null
                ? "It replaces your time on the board."
                : "You're already on the waitlist. This adds your time to the board."}
          </p>
          <JoinForm
            run={run}
            defaults={defaults}
            submitLabel={!me ? "See my rank" : me.bestMs != null ? "Save my new best" : "Save my time"}
            onJoined={onJoined}
          />
          <button
            type="button"
            onClick={onPlayAgain}
            className="mt-5 min-h-10 text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
          >
            Try for a faster time instead
          </button>
        </>
      )}
    </Card>
  );
}

interface DoneCardProps {
  result: JoinResponse;
  me: Me | null;
  onPlayAgain(): void;
  onClose(): void;
}

/** Joined: their place on the board, a way to dare friends, and another go. */
export function DoneCard({ result, me, onPlayAgain, onClose }: DoneCardProps) {
  const onBoard = result.bestMs !== null && result.rank !== null && result.board !== null;
  const name = result.firstName;

  if (onBoard) {
    const total = result.board!.total;
    const firstTime = result.improved && result.previousBestMs === null;
    const heading = firstTime ? "You're on the board" : result.improved ? "New best" : "Your best still stands";
    const note = !result.alreadyJoined
      ? `You're on the waitlist, ${name}. We'll email you first when we launch.`
      : firstTime
        ? `Your time is saved, ${name}. You were already on the waitlist.`
        : result.improved
          ? `Saved, ${name}. That's your fastest yet.`
          : `That run wasn't faster, so your best stays on the board, ${name}.`;
    return (
      <Card>
        <Burst />
        <p className="text-sm font-medium text-[#A78BFA]">{heading}</p>
        <h2 className="mt-2 flex items-baseline justify-center text-[56px] font-semibold leading-none tracking-tight sm:text-[68px]">
          #<RollingCount value={result.rank!} delay={200} />
        </h2>
        <p className="mt-3 text-text-secondary">
          of {total} on the board, at <span className="font-mono text-text-primary">{formatTime(result.bestMs!)}</span>
        </p>
        <p className="mt-5 text-text-primary">{note}</p>
        <ShareRow ms={result.bestMs!} />
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onPlayAgain} className={primaryButton}>
            Play again
          </button>
          <button type="button" onClick={onClose} className={ghostButton}>
            Back to the site
          </button>
        </div>
      </Card>
    );
  }

  const note = result.runRejected
    ? "We couldn't check that run, so it isn't on the board. Play again to post a time."
    : result.timeMs !== null
      ? "The leaderboard is offline right now, so this time wasn't saved."
      : result.alreadyJoined
        ? "You were already on it. We'll email you when your access is ready."
        : `We'll email ${me?.email ?? "you"} when your access is ready.`;

  return (
    <Card>
      <div className="flex justify-center">
        <LoopyMascot size={84} mood="wave" />
      </div>
      <h2 className="mt-5 text-3xl font-semibold tracking-tight">You&apos;re on the list, {name}.</h2>
      <p className="mt-3 text-text-secondary">{note}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onPlayAgain} className={primaryButton}>
          {result.timeMs === null ? "Play for the leaderboard" : "Play again"}
        </button>
        <button type="button" onClick={onClose} className={ghostButton}>
          Back to the site
        </button>
      </div>
    </Card>
  );
}

function ShareRow({ ms }: { ms: number }) {
  const [copied, setCopied] = useState<"" | "yes" | "no">("");
  const url = typeof window === "undefined" ? SITE_URL : window.location.origin;
  const text = `I beat Loopy's snake in ${formatTime(ms)} and got on the Loop Launch waitlist. Can you beat me?`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };

  return (
    <div className="mt-6">
      <p className="text-sm text-text-secondary">Dare a friend to beat it</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: "Loopy's snake", text, url }).catch(() => {})}
            className={ghostButton}
          >
            Share
          </button>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={ghostButton}
        >
          WhatsApp
        </a>
        <button type="button" onClick={copy} className={ghostButton}>
          {copied === "yes" ? "Copied" : copied === "no" ? "Copy failed" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative w-full max-w-[460px] rounded-3xl border border-border-subtle bg-bg-surface px-6 py-8 text-center sm:px-9 sm:py-10"
    >
      {children}
    </motion.div>
  );
}

/** Confetti from the top of the card when someone lands on the board. */
function Burst() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const angle = -Math.PI * (0.06 + (i / 15) * 0.88);
        const reach = 90 + ((i * 37) % 60);
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: i % 3 === 0 ? "#EDEDEF" : i % 3 === 1 ? "#8B5CF6" : "#A78BFA" }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach + 40, opacity: 0, rotate: 180 + i * 20, scale: 0.5 }}
            transition={{ duration: 1.1, delay: 0.15 + (i % 4) * 0.03, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
