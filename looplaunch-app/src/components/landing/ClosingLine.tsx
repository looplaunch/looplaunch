"use client";

import type { CSSProperties, FormEvent } from "react";
import { useWaitlistGame } from "@/components/waitlist/WaitlistGame";
import { FIRST_NAME_MAX } from "@/lib/waitlist/names";

const lineDelay = (i: number) => ({ "--d": `${i * 90}ms` }) as CSSProperties;

/** The closing sentence of the waitlist page: its blank is the first name, its last word opens the join flow. */
export function WaitlistClosingLine() {
  const { me, draftName, setDraftName, openGame } = useWaitlistGame();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    openGame();
  };

  return (
    <section id="join" className="ll-section ll-wrap" aria-labelledby="join-title">
      {me ? (
        <>
          <h2 id="join-title" className="ll-display">
            <span className="ll-line">
              <span data-reveal="line">You&apos;re on the list,</span>
            </span>
            <span className="ll-line">
              <span data-reveal="line" style={lineDelay(1)}>
                {me.firstName}.
              </span>
            </span>
          </h2>
          <p className="ll-lead ll-muted mt-8" data-reveal style={lineDelay(2)}>
            We&apos;ll email you first when Loop Launch opens.
          </p>
        </>
      ) : (
        <form onSubmit={submit}>
          <h2 id="join-title" className="ll-display">
            <span className="ll-line">
              <span data-reveal="line">Save a spot for</span>
            </span>
          </h2>
          <div className="ll-display ll-closing__fill">
            <span className="ll-line">
              <span data-reveal="line" style={lineDelay(1)}>
                <label htmlFor="closing-name" className="sr-only-ll">
                  Your first name
                </label>
                <input
                  id="closing-name"
                  className="ll-blank"
                  placeholder="you"
                  autoComplete="given-name"
                  maxLength={FIRST_NAME_MAX}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />{" "}
                <button type="submit" className="ll-blank-button">
                  Join.
                </button>
              </span>
            </span>
          </div>
          <p className="ll-lead ll-muted mt-10 max-w-[46ch]" data-reveal style={lineDelay(2)}>
            Get early access to your AI CMO. We&apos;ll email you first when Loop Launch opens.
          </p>
        </form>
      )}
    </section>
  );
}

/** The closing sentence of the full landing page (team only, at /home). */
export function StartClosingLine({ onStart }: { onStart: () => void }) {
  return (
    <section id="join" className="ll-section ll-wrap" aria-labelledby="join-title">
      <h2 id="join-title" className="ll-display">
        <span className="ll-line">
          <span data-reveal="line">Ready when</span>
        </span>
        <span className="ll-line">
          <span data-reveal="line" style={lineDelay(1)}>
            you are.{" "}
            <button type="button" className="ll-blank-button" onClick={onStart}>
              Start
            </button>
          </span>
        </span>
      </h2>
      <p className="ll-lead ll-muted mt-8" data-reveal style={lineDelay(2)}>
        Your market, your rivals and a plan in about two minutes.
      </p>
    </section>
  );
}
