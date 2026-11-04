"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";

type Intent = "ads" | "rivals" | "spend" | "why" | "other";

const EXAMPLES: { q: string; intent: Intent }[] = [
  { q: "Who bids on my name?", intent: "ads" },
  { q: "Who are my rivals?", intent: "rivals" },
  { q: "Where do I spend first?", intent: "spend" },
  { q: "Why pick us over them?", intent: "why" },
];

// Checked in order: the first that matches decides the sample answer.
const INTENTS: [Intent, RegExp][] = [
  ["ads", /\b(ads?|bid|bids|bidding|campaigns?|google|paid|sponsor)/i],
  ["rivals", /\b(rivals?|competitors?|competition|against|alternatives?)/i],
  ["spend", /\b(spend|channels?|budget|where|first|grow|instagram|seo|tiktok|email)/i],
  ["why", /\b(why|pick|choose|different|position|stand out|unique|message)/i],
];

const intentOf = (text: string): Intent => INTENTS.find(([, test]) => test.test(text))?.[0] ?? "other";

const TONE = {
  high: { background: "#10B981", color: "#09090B" },
  mid: { background: "#FACC15", color: "#09090B" },
  low: { background: "#3F3F46", color: "#F4F4F5" },
};

/** The section's headline is the question box: type, or pick an example, and the sample answer follows. */
export function AskSection() {
  const [text, setText] = useState(EXAMPLES[0].q);
  const [focused, setFocused] = useState(false);
  const [caretX, setCaretX] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const touched = useRef(false);
  const intent = intentOf(text);

  // The first time the section comes into view, the example question types itself in.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched.current) return;
        io.disconnect();
        const full = EXAMPLES[0].q;
        let n = 0;
        setText("");
        const type = () => {
          if (touched.current) return;
          n++;
          setText(full.slice(0, n));
          if (n < full.length) timer = window.setTimeout(type, 30 + Math.random() * 40);
        };
        timer = window.setTimeout(type, 250);
      },
      { threshold: 0.4 }
    );
    io.observe(section);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;
    setCaretX(Math.min(measure.offsetWidth - input.scrollLeft, input.clientWidth));
  }, [text, focused]);

  const pick = (q: string) => {
    touched.current = true;
    setText(q);
  };

  return (
    <section id="ask" ref={sectionRef} className="ll-section ll-wrap" aria-labelledby="ask-title">
      <h2 id="ask-title" className="sr-only-ll">
        Ask Loop Launch about your market
      </h2>

      <div className="ll-ask__field ll-display" data-ui data-reveal>
        <label htmlFor="ask-input" className="sr-only-ll">
          Your question
        </label>
        <input
          id="ask-input"
          ref={inputRef}
          className="ll-ask__input"
          value={text}
          placeholder="Ask anything…"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            touched.current = true;
            setText(e.target.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ caretColor: focused ? "var(--accent)" : "transparent" }}
          aria-describedby="ask-note"
        />
        <span ref={measureRef} className="ll-ask__measure" aria-hidden="true">
          {text}
        </span>
        {!focused && <span className="ll-ask__caret" style={{ left: caretX + 4 }} aria-hidden="true" />}
      </div>

      <div className="ll-grid ll-ask__below">
        <div className="ll-ask__side" data-reveal style={{ "--d": "120ms" } as CSSProperties}>
          <p id="ask-note" className="ll-lead ll-muted max-w-[34ch]">
            Ask it what you&apos;d ask a CMO. Here, it answers for Halfmoon, a sample coffee subscription.
          </p>
          <div className="ll-ask__examples" role="group" aria-label="Example questions">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.q}
                type="button"
                className="ll-ask__example"
                aria-pressed={text === ex.q}
                onClick={() => pick(ex.q)}
              >
                <span aria-hidden="true">→</span>
                {ex.q}
              </button>
            ))}
          </div>
        </div>

        <div className="ll-ask__answer" data-reveal style={{ "--d": "220ms" } as CSSProperties}>
          <div className="ll-answer" data-ui aria-live="polite">
            <div className="ll-answer__head">
              <span className="ll-answer__who">
                <Image src="/loopy-cutout.webp" alt="" width={26} height={26} />
                Loop Launch
              </span>
              <span>{intent === "other" ? "Needs your company" : "High confidence · 4 sources"}</span>
            </div>
            <Answer key={intent} intent={intent} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Answer({ intent }: { intent: Intent }) {
  if (intent === "ads") {
    return (
      <>
        <p className="ll-answer__lede">Two rivals bid on “Halfmoon coffee”. You don&apos;t.</p>
        <Rows
          rows={[
            { name: "Parcel Beans", tag: "3 ads", tone: "mid", text: "“Fresh coffee for half the price of Halfmoon”" },
            { name: "Driftwood Roasters", tag: "2 ads", tone: "mid", text: "“Roasted Monday, at your door by Wednesday”" },
            { name: "Halfmoon", tag: "0 ads", tone: "low", text: "Nothing shows for your own name." },
          ]}
        />
        <p className="ll-answer__foot">From Google&apos;s Ads Transparency Center, checked this week.</p>
      </>
    );
  }
  if (intent === "rivals") {
    return (
      <>
        <p className="ll-answer__lede">Three companies sell what you sell, to the same people.</p>
        <Rows
          rows={[
            { name: "Parcel Beans", score: 86, tone: "high", text: "Same plans, lower price, bids on your name." },
            { name: "Driftwood Roasters", score: 74, tone: "high", text: "Ranks above you for “fresh roasted coffee”." },
            { name: "Morning Ledger", score: 61, tone: "mid", text: "Wider range, slower shipping." },
          ]}
        />
        <p className="ll-answer__foot">Match is 0 to 100: how close each one is to you.</p>
      </>
    );
  }
  if (intent === "spend") {
    return (
      <>
        <p className="ll-answer__lede">Start with search. Your rivals are already there and you aren&apos;t.</p>
        <Rows
          rows={[
            { name: "Search ads on your name", tag: "First", tone: "high", text: "Win back the people already looking for you." },
            { name: "Comparison pages", tag: "First", tone: "high", text: "Buyers search “Halfmoon vs Parcel Beans”." },
            { name: "Instagram", tag: "Later", tone: "mid", text: "Busy, and your rivals post every day." },
          ]}
        />
        <p className="ll-answer__foot">Ranked by how fast each one can pay back.</p>
      </>
    );
  }
  if (intent === "why") {
    return (
      <>
        <p className="ll-answer__lede">Because you roast to order, and nobody else says when they roast.</p>
        <Rows
          rows={[
            { name: "Now", tag: "Today", tone: "low", text: "“Another coffee subscription.”" },
            { name: "Should be", tag: "Goal", tone: "high", text: "“The one that roasts the day it ships.”" },
            { name: "The gap", tag: "Own it", tone: "mid", text: "Put the roast date on every page and every ad." },
          ]}
        />
        <p className="ll-answer__foot">Positioning: where you are, where you should be, and the gap.</p>
      </>
    );
  }
  return (
    <>
      <p className="ll-answer__lede">
        Good question. Loop Launch reads your site, your rivals and their ads before it answers that one.
      </p>
      <p className="ll-answer__foot">Join the waitlist to ask it about your own company.</p>
    </>
  );
}

interface Row {
  name: string;
  text: string;
  tone: keyof typeof TONE;
  tag?: string;
  score?: number;
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="ll-answer__rows">
      {rows.map((row, i) => (
        <li key={row.name} className="ll-answer__row" style={{ "--i": i + 1 } as CSSProperties}>
          <b>{row.name}</b>
          <span className="ll-answer__tag" style={TONE[row.tone]}>
            {row.score != null ? <Roll value={row.score} /> : row.tag}
          </span>
          <p>{row.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** A score whose digits roll up to their value. */
function Roll({ value }: { value: number }) {
  const digits = String(value).split("");
  return (
    <>
      <span className="sr-only-ll">Match {value}</span>
      <span className="ll-roll" aria-hidden="true">
        {digits.map((d, i) => (
          <span key={i} className="ll-roll__strip" style={{ "--v": d, "--i": i } as CSSProperties}>
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        ))}
      </span>
    </>
  );
}
