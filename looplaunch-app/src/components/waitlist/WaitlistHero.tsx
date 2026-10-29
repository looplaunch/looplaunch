"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import GradientASCII from "@/components/ui/GradientASCII";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

const ASCII_COLORS = ["#ba1ed8", "#fff6ff", "#d3a5ff", "#8e38f8"];

/** The email box; the nav and final call-to-action buttons scroll here and focus it. */
export const WAITLIST_INPUT_ID = "waitlist-email";

interface WaitlistHeroProps {
  /** Set when someone is signed in but not on the team allowlist yet. */
  signedInEmail?: string | null;
}

type Status = "idle" | "sending" | "joined" | "already";

/** Hero of the public landing page while Loop Launch is invite-only: join the waitlist. */
export function WaitlistHero({ signedInEmail }: WaitlistHeroProps) {
  const router = useRouter();
  const [email, setEmail] = useState(signedInEmail ?? "");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company: honeypot }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyJoined?: boolean };
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus(data.alreadyJoined ? "already" : "joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    router.refresh();
  };

  const scrollToExplore = () => {
    document.getElementById("what-is-it")?.scrollIntoView({ behavior: "smooth" });
  };

  const done = status === "joined" || status === "already";

  return (
    <section
      id="hero-section"
      className="relative flex min-h-[92vh] flex-col items-center overflow-hidden bg-black px-6 pt-16 pb-12 text-text-primary"
    >
      <GradientASCII
        colors={ASCII_COLORS}
        shape="horizon"
        characters=" =+xX0S8#@"
        cellSize={18}
        density={0.8}
        className="!absolute inset-0"
      />
      {/* Darkens the middle so the headline and form stay readable, and fades into the next section */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_55%,rgba(0,0,0,0.65),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#09090B]"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
        className="relative z-10 my-auto flex w-full max-w-xl flex-col items-center py-10 text-center"
      >
        <span className="mb-6 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-text-secondary backdrop-blur">
          Invite-only beta
        </span>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your AI CMO is
          <br />
          almost here.
        </h1>
        <p className="mt-5 max-w-md text-base text-text-secondary sm:text-lg">
          Loop Launch studies your market, your competitors and their ads, then hands you a marketing plan you can run
          this week. Join the waitlist for early access.
        </p>

        <div className="mt-9 w-full max-w-md">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-left backdrop-blur-md"
              >
                <LoopyMascot size={56} mood="wave" />
                <div>
                  <p className="font-semibold">
                    {status === "already" ? "You're already on the list!" : "You're on the list!"}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    We&apos;ll email <span className="text-text-primary">{email.trim().toLowerCase()}</span> when your
                    access is ready.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={join}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur-md sm:flex-row"
              >
                <label htmlFor={WAITLIST_INPUT_ID} className="sr-only">
                  Email address
                </label>
                <input
                  id={WAITLIST_INPUT_ID}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-text-primary outline-none placeholder:text-text-placeholder"
                />
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
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                >
                  {status === "sending" ? "Joining…" : "Join the waitlist"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
          {signedInEmail && !done && (
            <p className="mt-4 text-sm text-text-secondary">
              You&apos;re signed in as {signedInEmail}, which doesn&apos;t have early access yet.{" "}
              <button type="button" onClick={signOut} className="underline underline-offset-2 hover:text-text-primary">
                Log out
              </button>
            </p>
          )}
        </div>
      </motion.div>

      {/* Subtle scroll indicator, same as the original hero */}
      <div className="relative z-10 flex w-full justify-center pt-4">
        <button
          onClick={scrollToExplore}
          className="flex cursor-pointer items-center gap-1.5 text-xs tracking-wider text-text-tertiary transition-colors hover:text-text-secondary focus:outline-none"
        >
          <span>Scroll</span>
          <span>&darr;</span>
        </button>
      </div>
    </section>
  );
}
