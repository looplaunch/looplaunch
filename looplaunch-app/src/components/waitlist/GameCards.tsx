"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion, type Variants } from "motion/react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { RollingCount } from "@/components/dashboard/RollingCount";
import { FIRST_NAME_MAX, cleanFirstName } from "@/lib/waitlist/names";
import { TARGET, formatTime, type FinishedRun } from "@/lib/waitlist/snake";
import type { Board, JoinResponse } from "@/lib/waitlist/types";
import { bestRank, rankOn } from "./WaitlistGame";
import { JoinButton, type JoinPhase } from "./JoinButton";
import type { Me } from "./me";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SITE_URL = "https://looplaunch.co";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-6 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#7C3AED] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60";
const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-text-primary transition-colors hover:border-white/40";
const field =
  "mt-2 h-12 w-full rounded-xl border bg-black/40 px-4 text-base text-text-primary placeholder:text-text-placeholder transition-[border-color,background-color,transform] duration-200 hover:border-white/30 focus:-translate-y-px focus:border-white focus:bg-black/60 disabled:opacity-50";

// How long the tick and "You're on the waitlist" stay up before the card moves on.
const TICK_HOLD_MS = 1900;

// The card's pieces rise in one after another.
const stack: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 26 } },
};

function Rise({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "p" | "h2" }) {
  const Tag = motion[as];
  return (
    <Tag variants={rise} className={className}>
      {children}
    </Tag>
  );
}

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
  const [phase, setPhase] = useState<JoinPhase>("idle");
  const sending = phase !== "idle";
  const pending = useRef<{ result: JoinResponse; email: string } | null>(null);
  const joinedRef = useRef(onJoined);
  useEffect(() => {
    joinedRef.current = onJoined;
  }, [onJoined]);
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

    setPhase("sending");
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
      // Show the tick first; the card moves on once it has landed.
      pending.current = { result: data as JoinResponse, email: mail };
      setPhase("done");
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't save that. Please try again." });
      setPhase("idle");
    }
  };

  useEffect(() => {
    if (phase !== "done") return;
    const flush = () => {
      const p = pending.current;
      pending.current = null;
      if (p) joinedRef.current(p.result, p.email);
    };
    const timer = setTimeout(flush, TICK_HOLD_MS);
    // Closed mid-tick: they're still joined, so record it.
    return () => {
      clearTimeout(timer);
      flush();
    };
  }, [phase]);

  return (
    <motion.form
      onSubmit={submit}
      noValidate
      className="mt-6 text-left"
      variants={stack}
      initial="hidden"
      animate="show"
    >
      <motion.label variants={rise} className="block">
        <span className="text-sm font-medium text-text-secondary">First name</span>
        <input
          ref={nameRef}
          value={firstName}
          disabled={sending}
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
          <motion.span
            id="join-name-error"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [-6, 4, -2, 0] }}
            className="mt-1.5 block text-sm text-[#FCA5A5]"
          >
            {errors.name}
          </motion.span>
        )}
      </motion.label>

      <motion.label variants={rise} className="mt-4 block">
        <span className="text-sm font-medium text-text-secondary">Email</span>
        <input
          ref={emailRef}
          type="email"
          inputMode="email"
          value={email}
          disabled={sending}
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
          <motion.span
            id="join-email-error"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [-6, 4, -2, 0] }}
            className="mt-1.5 block text-sm text-[#FCA5A5]"
          >
            {errors.email}
          </motion.span>
        )}
      </motion.label>

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

      <motion.div variants={rise}>
        <JoinButton
          ref={submitRef}
          phase={phase}
          label={submitLabel}
          doneTitle="You're on the waitlist!"
          doneNote="We'll email you the moment your access is ready."
        />
      </motion.div>
      {errors.form && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center text-sm text-[#FCA5A5]"
          role="alert"
        >
          {errors.form}
        </motion.p>
      )}
    </motion.form>
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
        <Rise as="h2" className="text-3xl font-semibold tracking-tight">
          Join the waitlist
        </Rise>
        <Rise as="p" className="mt-2 text-text-secondary">
          Get in first. We&apos;ll email you when your access is ready.
        </Rise>
        <JoinForm run={null} defaults={defaults} submitLabel="Join waitlist" onJoined={onJoined} />
        <Rise as="p" className="mt-6 text-sm text-text-secondary">
          Rather earn a spot on the board?{" "}
          <button type="button" onClick={onPlayAgain} className="text-text-primary underline underline-offset-4">
            Play Loopy&apos;s snake
          </button>
        </Rise>
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
      <Rise as="p" className="text-sm font-medium text-[#A78BFA]">
        You ate all {TARGET} words
      </Rise>
      <motion.p
        initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.1 }}
        className="mt-3 font-mono text-[56px] font-semibold leading-none tabular-nums sm:text-[68px]"
      >
        <CountUp ms={run.timeMs} />
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
          {standing && (
            <Rise as="p" className="mt-4 text-text-secondary">
              {standing}
            </Rise>
          )}
          <Rise as="h2" className="mt-8 text-2xl font-semibold tracking-tight">
            {!me ? "Claim your spot" : me.bestMs != null ? "Save your new best" : "Put it on the board"}
          </Rise>
          <Rise as="p" className="mt-2 text-sm text-text-secondary">
            {!me
              ? "Add your name and email to join the waitlist and put this time on the board."
              : me.bestMs != null
                ? "It replaces your time on the board."
                : "You're already on the waitlist. This adds your time to the board."}
          </Rise>
          <JoinForm
            run={run}
            defaults={defaults}
            submitLabel={!me ? "Join waitlist" : me.bestMs != null ? "Save my new best" : "Save my time"}
            onJoined={onJoined}
          />
          <Rise>
            <button
              type="button"
              onClick={onPlayAgain}
              className="mt-5 min-h-10 text-sm text-text-secondary underline underline-offset-4 transition-colors hover:text-text-primary"
            >
              Try for a faster time instead
            </button>
          </Rise>
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
        <Rise as="p" className="text-sm font-medium text-[#A78BFA]">
          {heading}
        </Rise>
        <motion.h2
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 1.12, 1], opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 flex items-baseline justify-center text-[56px] font-semibold leading-none tracking-tight sm:text-[68px]">
          #<RollingCount value={result.rank!} delay={200} />
        </motion.h2>
        <Rise as="p" className="mt-3 text-text-secondary">
          of {total} on the board, at <span className="font-mono text-text-primary">{formatTime(result.bestMs!)}</span>
        </Rise>
        <Rise as="p" className="mt-5 text-text-primary">
          {note}
        </Rise>
        <Rise>
          <ShareRow ms={result.bestMs!} />
        </Rise>
        <Rise className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onPlayAgain} className={primaryButton}>
            Play again
          </button>
          <button type="button" onClick={onClose} className={ghostButton}>
            Back to the site
          </button>
        </Rise>
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
      <motion.div
        className="flex justify-center"
        initial={{ y: -30, opacity: 0, rotate: -12 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 12 }}
      >
        <LoopyMascot size={84} mood="wave" />
      </motion.div>
      <Rise as="h2" className="mt-5 text-3xl font-semibold tracking-tight">
        You&apos;re on the list, {name}.
      </Rise>
      <Rise as="p" className="mt-3 text-text-secondary">
        {note}
      </Rise>
      <Rise className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onPlayAgain} className={primaryButton}>
          {result.timeMs === null ? "Play for the leaderboard" : "Play again"}
        </button>
        <button type="button" onClick={onClose} className={ghostButton}>
          Back to the site
        </button>
      </Rise>
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
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      // Stretched to the leaderboard's height beside it on wide screens, its content centred.
      className="relative w-full max-w-[460px] rounded-3xl border border-border-subtle bg-bg-surface px-6 py-8 text-center sm:px-9 sm:py-10 lg:flex lg:flex-col lg:justify-center"
    >
      <motion.div variants={stack} initial="hidden" animate="show">
        {children}
      </motion.div>
    </motion.div>
  );
}

/** The run's time, ticking up from zero to where it stopped. */
function CountUp({ ms }: { ms: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, ms / 1000, {
      duration: 0.9,
      delay: 0.15,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(2);
      },
    });
    return () => controls.stop();
  }, [ms, reduce]);
  return <span ref={ref}>{(ms / 1000).toFixed(2)}</span>;
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
