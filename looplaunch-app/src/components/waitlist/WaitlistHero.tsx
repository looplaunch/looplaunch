"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import GradientASCII from "@/components/ui/GradientASCII";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { smoothScrollTo } from "@/lib/smooth-scroll";
import { formatTime } from "@/lib/waitlist/snake";
import { useWaitlistGame } from "./WaitlistGame";

const ASCII_COLORS = ["#ba1ed8", "#9333ea", "#8b5cf6", "#8e38f8"];

/** Hero of the public landing page while Loop Launch is invite-only: join the waitlist. */
export function WaitlistHero() {
  const router = useRouter();
  const { me, arena, signedInEmail, openGame } = useWaitlistGame();
  const unclaimed = !arena.open ? arena.run : null;

  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    router.refresh();
  };

  const scrollToExplore = () => {
    const section = document.getElementById("how-it-works");
    if (section) smoothScrollTo(section);
  };

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

        <div className="mt-9 w-full max-w-lg">
          <AnimatePresence mode="wait">
            {me ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-left backdrop-blur-md"
              >
                <LoopyMascot size={56} mood="wave" />
                <div>
                  <p className="font-semibold">You&apos;re on the list, {me.firstName}!</p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    We&apos;ll email <span className="text-text-primary">{me.email}</span> when your access is ready.
                  </p>
                </div>
              </motion.div>
            ) : unclaimed ? (
              <motion.div
                key="unclaimed"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-left backdrop-blur-md"
              >
                <p className="text-sm text-text-secondary">
                  You finished in{" "}
                  <span className="font-semibold tabular-nums text-text-primary">{formatTime(unclaimed.timeMs)}</span>.
                  Your spot isn&apos;t saved yet.
                </p>
                <button
                  type="button"
                  onClick={openGame}
                  className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Claim it
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="join"
                exit={{ opacity: 0, y: -8 }}
                className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={openGame}
                  className="w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99]"
                >
                  Join the waitlist
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {signedInEmail && !me && (
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
