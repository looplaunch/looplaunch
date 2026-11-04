import type { CSSProperties, ReactNode } from "react";

const STEPS: { line: string; text: string; frag: ReactNode }[] = [
  {
    line: "It reads your site.",
    text: "Your pages, your prices and the way you talk about yourself.",
    frag: <SiteFrag />,
  },
  {
    line: "It finds your rivals.",
    text: "Up to ten competitors from live Google results, each scored for how close it is.",
    frag: <RivalsFrag />,
  },
  {
    line: "It reads their ads.",
    text: "The ads they run right now, from Google's Ads Transparency Center.",
    frag: <AdFrag />,
  },
  {
    line: "You get the plan.",
    text: "Where you can win, who to talk to, and which channel goes first.",
    frag: <PlanFrag />,
  },
];

/**
 * How it works, written as four lines that step down the page; order is in the position, not in
 * numbers. Beside each line, the piece of a real analysis that step produces (for a sample company).
 */
export function StepsSection() {
  return (
    <section id="how-it-works" className="ll-section ll-wrap" aria-labelledby="how-it-works-title">
      <h2 id="how-it-works-title" className="sr-only-ll">
        How Loop Launch works
      </h2>
      <ol className="ll-steps">
        {STEPS.map((step, i) => (
          <li
            key={step.line}
            className={`ll-step ll-step--${i}${i === STEPS.length - 1 ? " ll-step--last" : ""}`}
            style={{ "--n": i } as CSSProperties}
          >
            <div className="ll-step__body">
              <h3 className="ll-head">
                <span className="ll-line">
                  <span data-reveal="line">{step.line}</span>
                </span>
              </h3>
              <p className="ll-step__text ll-muted" data-reveal style={{ "--d": "160ms" } as CSSProperties}>
                {step.text}
              </p>
            </div>
            <div className="ll-step__frag" data-reveal style={{ "--d": "240ms" } as CSSProperties}>
              {step.frag}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const Tick = ({ i }: { i: number }) => (
  <svg viewBox="0 0 20 20" className="ll-tick" style={{ "--i": i } as CSSProperties} aria-hidden="true">
    <circle cx="10" cy="10" r="10" />
    <path d="M5.5 10.5l3 3 6-6.5" />
  </svg>
);

function SiteFrag() {
  return (
    <div className="ll-frag" data-ui>
      <div className="ll-frag__head">
        <b>Reading halfmoon.coffee</b>
        <span>14 pages</span>
      </div>
      <ul className="ll-frag__rows">
        <li>
          <Tick i={0} /> Home, plans and about pages
        </li>
        <li>
          <Tick i={1} /> 3 plans, from $14 a bag
        </li>
        <li>
          <Tick i={2} /> Says: “Small-batch coffee, delivered”
        </li>
      </ul>
    </div>
  );
}

function RivalsFrag() {
  const rivals = [
    { name: "Parcel Beans", score: 86 },
    { name: "Driftwood Roasters", score: 74 },
    { name: "Morning Ledger", score: 61 },
  ];
  return (
    <div className="ll-frag" data-ui>
      <div className="ll-frag__head">
        <b>Competitors</b>
        <span>Match, 0 to 100</span>
      </div>
      <ul className="ll-frag__rows">
        {rivals.map((r, i) => (
          <li key={r.name} className="ll-frag__score">
            <span>{r.name}</span>
            <span className="ll-bar" aria-hidden="true">
              <span style={{ "--s": r.score / 100, "--i": i } as CSSProperties} />
            </span>
            <b className="tabular-nums">{r.score}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdFrag() {
  return (
    <div className="ll-frag" data-ui>
      <div className="ll-frag__head">
        <b>Parcel Beans</b>
        <span>3 ads running</span>
      </div>
      <div className="ll-frag__ad">
        <span className="ll-frag__sponsor">Sponsored · parcelbeans.com</span>
        <b>Fresh coffee for half the price of Halfmoon</b>
        <span>Roasted weekly, shipped free. Cancel any time.</span>
      </div>
      <p className="ll-frag__foot">On Google Search since August</p>
    </div>
  );
}

function PlanFrag() {
  const tasks = ["Bid on your own name", "Publish “Halfmoon vs Parcel Beans”", "Put the roast date in every ad"];
  return (
    <div className="ll-frag" data-ui>
      <div className="ll-frag__head">
        <b>This week</b>
        <span>3 moves</span>
      </div>
      <ul className="ll-frag__rows">
        {tasks.map((t, i) => (
          <li key={t}>
            <Tick i={i} /> {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
