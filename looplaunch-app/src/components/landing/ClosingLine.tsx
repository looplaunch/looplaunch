"use client";

import type { CSSProperties } from "react";

const lineDelay = (i: number) => ({ "--d": `${i * 90}ms` }) as CSSProperties;

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
