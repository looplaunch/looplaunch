"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useWaitlistGame } from "@/components/waitlist/WaitlistGame";
import { siteConfig } from "@/lib/seo";
import { smoothScrollTo } from "@/lib/smooth-scroll";
import "./waitlist-sections.css";

/**
 * The product demo. Paste a video address here (an .mp4/.webm file, or a YouTube/Vimeo embed link)
 * and the "Coming soon" frame becomes the video.
 */
const DEMO_VIDEO_URL = "/demo/loop-launch-demo.mp4";
/** The still shown before the video plays (an .mp4 only). */
const DEMO_POSTER = "/demo/loop-launch-demo-poster.jpg";

const INSTAGRAM_URL = "https://www.instagram.com/looplaunch.in/";

/** Delay for the landing page's scroll reveal (landing.css), to stagger a group. */
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Becomes true the first time the element is on screen. Reduced motion is handled in the CSS. */
function useSeen<T extends Element>(threshold = 0.4) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

const stillMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Jumps to a section with the page's smooth scroller. */
function jumpTo(e: React.MouseEvent, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  smoothScrollTo(target);
}

function JoinButton({ children = "Join the waitlist", industry }: { children?: ReactNode; industry?: string }) {
  const { openGame } = useWaitlistGame();
  return (
    <button type="button" className="nw-btn nw-btn-primary" onClick={() => openGame(industry)}>
      {children}
    </button>
  );
}

/** Everything below the waitlist hero: why, how, the demo, what you get, proof, FAQ. */
export function WaitlistSections() {
  return (
    <div className="nw">
      <ProblemSection />
      <HowSection />
      <DemoSection />
      <GetSection />
      <HumanSection />
      <TipsSection />
      <CredSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
}

/* ─── The problem, with numbers ─── */

const SHUTDOWNS = [
  { label: "Ran out of capital", value: 70 },
  { label: "Poor product-market fit", value: 43, ours: true },
  { label: "Wrong market timing", value: 29 },
  { label: "Unsustainable unit economics", value: 19 },
  { label: "Ineffective strategic pivot", value: 6, ours: true },
  { label: "Outcompeted by rivals", value: 6, ours: true },
];
const SMALL_BUSINESSES = [
  { label: "Aren’t sure their marketing strategy is working", value: 73, ours: true },
  { label: "Say finding new customers is their top challenge", value: 60 },
  { label: "Have an hour or less a day for marketing", value: 56 },
  { label: "Routinely put off marketing", value: 52, ours: true },
];

function Bars({ rows }: { rows: { label: string; value: number; ours?: boolean }[] }) {
  return (
    <ul className="nw-bars">
      {rows.map((row, i) => (
        <li key={row.label} className={row.ours ? "nw-hi" : undefined}>
          <span className="nw-b-l">{row.label}</span>
          <span className="nw-b-n">{row.value}%</span>
          <span className="nw-b-t" aria-hidden="true">
            <i style={{ width: `${row.value}%`, transitionDelay: `${i * 80}ms` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProblemSection() {
  const [cardsRef, grown] = useSeen<HTMLDivElement>(0.25);
  return (
    <section className="nw-sec" id="problem" aria-labelledby="problem-h">
      <div className="nw-wrap">
        <div className="nw-pb-row">
          <div data-reveal>
            <p className="nw-eyebrow">What founders told us</p>
            <h2 className="nw-h2 nw-pb-h" id="problem-h">
              They had a team. but no one to think marketing.
            </h2>
          </div>
          <div>
            <div className="nw-asks">
              {[
                ["A CMO?", "Out of budget."],
                ["An agency?", "Too costly to keep."],
                ["A marketing head?", "Not yet."],
              ].map(([q, a], i) => (
                <div className="nw-ask" key={q} data-reveal style={delay(i * 80)}>
                  <p className="nw-ask-q">{q}</p>
                  <p className="nw-ask-a">{a}</p>
                </div>
              ))}
            </div>
            <p className="nw-pb-line" data-reveal>
              So the team posts, but nobody decides what’s worth posting. That’s the gap Loopy fills.
            </p>
          </div>
        </div>

        <div className="nw-pb-row nw-pb-row2">
          <div data-reveal>
            <p className="nw-eyebrow">The problem</p>
            <h2 className="nw-h2 nw-pb-h">The problem isn’t effort. It’s direction.</h2>
          </div>
          <div>
            <div ref={cardsRef} className={`nw-stat-cards${grown ? " nw-go" : ""}`}>
              <figure className="nw-stat-card" data-reveal>
                <figcaption>
                  <h3 className="nw-sc-t">Why startups shut down</h3>
                  <p className="nw-sc-s">
                    % of 385 VC-backed startup shutdowns with known reasons. More than one reason can apply. Top 6 of 9
                    shown.
                  </p>
                </figcaption>
                <Bars rows={SHUTDOWNS} />
                <p className="nw-sc-src">Source: CB Insights</p>
              </figure>
              <figure className="nw-stat-card" data-reveal style={delay(80)}>
                <figcaption>
                  <h3 className="nw-sc-t">How small businesses handle marketing</h3>
                  <p className="nw-sc-s">% of 1,300 small businesses surveyed in Australia, Canada, the UK and the US.</p>
                </figcaption>
                <Bars rows={SMALL_BUSINESSES} />
                <p className="nw-sc-src">Source: Constant Contact, Small Business Now</p>
              </figure>
            </div>
            <div className="nw-pb-foot" data-reveal>
              <p>Loopy works on the purple bars: fit, competition, strategy and what to post.</p>
              <JoinButton />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How the 7-day strategy works: a loop line drawn through the steps as you scroll ─── */

const STEPS = [
  ["We scan your business.", "Your website, your offer, your prices, and the way you talk about yourself."],
  ["We study your competitors.", "Who you’re really up against, what they promise, and where they spend."],
  ["We read your market.", "What’s moving in your space right now, and what’s fading."],
  ["We find what works for you, and what doesn’t.", "Not for ‘brands like you’. For you."],
  ["You get your 7-day strategy.", "What to stop, what to start, and what to do this week."],
];

function useTimelineLoop() {
  const tlRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const tl = tlRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!tl || !svg || !path) return;
    const steps = [...tl.querySelectorAll<HTMLElement>(".nw-step")];
    let len = 0;
    let stops: number[] = [];

    const update = () => {
      if (!len) return;
      const box = tl.getBoundingClientRect();
      const p = stillMotion() ? 1 : Math.max(0, Math.min(1, (window.innerHeight * 0.7 - box.top) / (box.height || 1)));
      path.style.strokeDashoffset = String(len * (1 - p));
      steps.forEach((step, i) => step.classList.toggle("nw-on", p > 0 && p >= stops[i] - 0.001));
    };

    const build = () => {
      const box = tl.getBoundingClientRect();
      if (!box.width) return;
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      const pts = steps.map((step) => {
        const r = step.querySelector(".nw-num")!.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
      });
      // In a row (wide screens) the line waves up and down; in a column it sways a little sideways.
      const horizontal = Math.abs(pts[pts.length - 1].y - pts[0].y) < 4;
      const segments = [`M${pts[0].x} ${pts[0].y}`];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (horizontal) {
          const dx = b.x - a.x;
          const amp = (i % 2 ? -1 : 1) * 22;
          segments.push(`C${a.x + dx * 0.35} ${a.y + amp}, ${a.x + dx * 0.65} ${b.y + amp}, ${b.x} ${b.y}`);
        } else {
          const dy = b.y - a.y;
          const off = (i % 2 ? 1 : -1) * 6;
          segments.push(`C${a.x + off} ${a.y + dy * 0.35}, ${b.x + off} ${a.y + dy * 0.65}, ${b.x} ${b.y}`);
        }
      }
      path.setAttribute("d", segments.join(" "));
      len = path.getTotalLength();
      // How far along the line each number sits, so each lights up as the line reaches it.
      const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
      stops = segments.map((_, i) => {
        if (i === 0) return 0;
        probe.setAttribute("d", segments.slice(0, i + 1).join(" "));
        return probe.getTotalLength() / len;
      });
      path.style.strokeDasharray = String(len);
      update();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 120);
    };
    build();
    document.fonts?.ready.then(build);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { tlRef, svgRef, pathRef };
}

function HowSection() {
  const { tlRef, svgRef, pathRef } = useTimelineLoop();
  return (
    <section className="nw-sec" id="how" aria-labelledby="how-h">
      <div className="nw-wrap">
        <div className="nw-head nw-center" data-reveal>
          <h2 className="nw-h2" id="how-h">
            One week. One clear plan. Built around you.
          </h2>
          <p className="nw-sub">Here’s what your virtual CMO does before it tells you anything.</p>
        </div>
        <div className="nw-timeline" ref={tlRef}>
          <svg className="nw-tl-line" ref={svgRef} aria-hidden="true">
            <path ref={pathRef} d="" />
          </svg>
          <ol className="nw-steps">
            {STEPS.map(([title, text], i) => (
              <li className="nw-step" key={title}>
                <span className="nw-num">{i + 1}</span>
                <div>
                  <h3 className="nw-h3">{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="nw-center-actions" data-reveal>
          <JoinButton>Get my 7-day strategy</JoinButton>
          <p className="nw-small nw-muted">Join the waitlist to be first in line.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Product demo ─── */

function DemoSection() {
  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(DEMO_VIDEO_URL);
  return (
    <section className="nw-sec" id="demo" aria-labelledby="demo-h">
      <div className="nw-wrap">
        <div className="nw-head nw-center" data-reveal>
          <p className="nw-eyebrow">See it work</p>
          <h2 className="nw-h2" id="demo-h">
            Watch Loopy build a plan.
          </h2>
        </div>
        <div className={`nw-demo-frame${DEMO_VIDEO_URL ? " nw-demo-has-video" : ""}`} data-reveal>
          {!DEMO_VIDEO_URL ? (
            <div className="nw-demo-ph">
              <span className="nw-demo-play" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M9 7.5v9l7.5-4.5z" />
                </svg>
              </span>
              <p className="nw-demo-l">Product demo</p>
              <p className="nw-small nw-muted">Coming soon. The waitlist sees it first.</p>
            </div>
          ) : isFile ? (
            <video src={DEMO_VIDEO_URL} poster={DEMO_POSTER} controls playsInline preload="metadata" aria-label="Loop Launch product demo" />
          ) : (
            <iframe
              src={DEMO_VIDEO_URL}
              title="Loop Launch product demo"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── What you get: the brand name typed rewrites the card titles (nothing is saved) ─── */

const GETS = [
  ["Stop", "The things eating your time and money that aren’t moving anything."],
  ["Start", "The moves worth making now, ranked so you know what comes first."],
  ["This week", "A simple plan for the next 7 days, one step at a time."],
  ["Your angle", "The idea that’s yours, not borrowed from a template. The thing people remember you for."],
];

function GetSection() {
  const [brand, setBrand] = useState("");
  const name = brand.trim();
  return (
    <section className="nw-sec" id="get" aria-labelledby="get-h">
      <div className="nw-wrap">
        <div className="nw-head nw-center" data-reveal>
          <h2 className="nw-h2" id="get-h">
            Something only your brand owns.
          </h2>
          <p className="nw-sub">Nothing fancy. Just enough to catch your audience and build your brand.</p>
        </div>
        <div className="nw-brandfield" data-reveal>
          <label htmlFor="nw-brandname" className="nw-small nw-muted">
            Type your brand name
          </label>
          <input
            id="nw-brandname"
            type="text"
            autoComplete="off"
            maxLength={40}
            spellCheck={false}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </div>
        <div className="nw-grid4">
          {GETS.map(([title, text], i) => (
            <article
              key={title}
              className={`nw-card${title === "Stop" || title === "Your angle" ? " nw-card-hi" : ""}`}
              data-reveal
              style={delay(i * 80)}
            >
              <h3 className="nw-h3">{name ? `${title}, ${name}` : title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="nw-closing nw-get-closing" data-reveal>
          Your competitors can’t copy it, because it was never built for them.
        </p>
      </div>
    </section>
  );
}

/* ─── Built by people: counters and the comparison ─── */

function Counter({ to, comma = false }: { to: number; comma?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) => (comma ? n.toLocaleString("en-US") : String(n));
  useEffect(() => {
    const el = ref.current;
    if (!el || stillMotion()) return;
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        io.disconnect();
        let start: number | null = null;
        const tick = (t: number) => {
          start ??= t;
          const k = 1 - Math.pow(1 - Math.min(1, (t - start) / 1400), 3);
          el.textContent = comma ? Math.round(to * k).toLocaleString("en-US") : String(Math.round(to * k));
          if (k < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, comma]);
  return <span ref={ref}>{format(to)}</span>;
}

const COMPARE = [
  ["Advice", "Same for everyone", "Built for your brand"],
  ["Starting point", "A template", "Your business, your rivals, your market"],
  ["What you get", "Ideas", "What to stop, what to start, what to do this week"],
  ["Built by", "Whoever wrote the prompt", "11 people, 1,550+ hours"],
];

function HumanSection() {
  const [compareRef, lit] = useSeen<HTMLDivElement>();
  return (
    <section className="nw-sec" id="human" aria-labelledby="human-h">
      <div className="nw-wrap">
        <h2 className="nw-h2 nw-narrow" id="human-h" data-reveal>
          We’re not another AI tool. We’re your strategy and content engine.
        </h2>
        <div className="nw-human-grid">
          <div className="nw-nums">
            <div className="nw-numblk" data-reveal>
              <span className="nw-bignum">
                <Counter to={1550} comma />+
              </span>
              <span className="nw-small nw-muted">human brain hours, plugged into one system</span>
            </div>
            <div className="nw-numblk" data-reveal style={delay(80)}>
              <span className="nw-bignum">
                <Counter to={11} />
              </span>
              <span className="nw-small nw-muted">human brains who built it</span>
            </div>
          </div>
          <p className="nw-body" data-reveal>
            Eleven of us spent 1,550+ hours thinking, testing and arguing about what actually grows a young brand. All of
            it went into one engine. So when Loopy looks at your business, it thinks the way a good CMO would: it asks
            why, it checks your market, and it tells you straight.
          </p>
        </div>
        <div className={`nw-compare${lit ? " nw-lit" : ""}`} ref={compareRef} data-reveal>
          <table>
            <caption className="nw-sr">Generic tools compared with Loopy</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">Generic tools</th>
                <th scope="col" className="nw-ll">
                  Loopy
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([row, generic, loopy]) => (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  <td data-l="Generic tools">{generic}</td>
                  <td className="nw-ll" data-l="Loopy">
                    {loopy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─── A free tip per industry ─── */

const TIPS = [
  {
    industry: "Fashion",
    tip: "Stop posting looks with no fabric, fit or how-to-order detail. This week, reshoot one bestseller in daylight on a real person.",
    cta: "Get the full Fashion plan",
  },
  {
    industry: "Food & Beverage",
    tip: "Stop “fresh, tasty, yummy” captions any brand could post. This week, film one real order being packed and say who it’s for.",
    cta: "Get the full Food & Beverage plan",
  },
  {
    industry: "Beauty & Personal Care",
    tip: "Stop listing ingredients without saying what they do for the user. This week, post a simple how-to-use clip in natural light.",
    cta: "Get the full Beauty plan",
  },
];

function TipsSection() {
  const [current, setCurrent] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { openGame } = useWaitlistGame();

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TIPS.length) % TIPS.length;
    setCurrent(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="nw-sec" id="tips" aria-labelledby="tips-h">
      <div className="nw-wrap">
        <div className="nw-head nw-center" data-reveal>
          <p className="nw-eyebrow">A free one, on us</p>
          <h2 className="nw-h2" id="tips-h">
            One thing to try this week.
          </h2>
        </div>
        <div className="nw-tipbox" data-reveal>
          <div className="nw-tabs" role="tablist" aria-label="Pick your industry">
            {TIPS.map((t, i) => (
              <button
                key={t.industry}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`nw-tab-${i}`}
                aria-controls={`nw-tp-${i}`}
                aria-selected={current === i}
                tabIndex={current === i ? 0 : -1}
                onClick={() => setCurrent(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {t.industry}
              </button>
            ))}
          </div>
          {TIPS.map((t, i) => (
            <div key={t.industry} className="nw-tip" role="tabpanel" id={`nw-tp-${i}`} aria-labelledby={`nw-tab-${i}`} hidden={current !== i}>
              <p className="nw-tip-t">{t.tip}</p>
              <button type="button" className="nw-tip-link" onClick={() => openGame(t.industry)}>
                {t.cta} <span aria-hidden="true">→</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── We did this by hand first ─── */

function CredSection() {
  return (
    <section className="nw-sec" id="cred" aria-labelledby="cred-h">
      <div className="nw-wrap nw-cred">
        <h2 className="nw-h2" id="cred-h" data-reveal>
          We did this by hand first.
        </h2>
        <p className="nw-body" data-reveal>
          Before Loopy was an engine, it was us. For about 1.8 years we ran marketing for founders ourselves, organic first
          and community first. Loopy is everything we learned, built so more founders can have it.
        </p>
        <dl className="nw-stats">
          <div className="nw-stat" data-reveal>
            <dt className="nw-statnum">
              <Counter to={43} />+
            </dt>
            <dd className="nw-small nw-muted">founders worked with</dd>
          </div>
          <div className="nw-stat" data-reveal style={delay(80)}>
            <dt className="nw-statnum">
              <Counter to={23} />+
            </dt>
            <dd className="nw-small nw-muted">industries</dd>
          </div>
          <div className="nw-stat" data-reveal style={delay(160)}>
            <dt className="nw-statnum">
              <Counter to={5} />M
            </dt>
            <dd className="nw-small nw-muted">organic views in the first 60 days</dd>
          </div>
          <div className="nw-stat" data-reveal style={delay(240)}>
            <dt className="nw-statnum">Clients</dt>
            <dd className="nw-small nw-muted">across India, UAE, Singapore, Vietnam, Australia, the US, the UK and Europe</dd>
          </div>
        </dl>
      
      </div>
    </section>
  );
}

/* ─── FAQ: one open at a time (details with a shared name) ─── */

const FAQS = [
  [
    "What is Loopy?",
    "A virtual CMO for founders who can’t afford one yet. It studies your business, your competitors and your market, and tells you what to stop, what to start and what to do this week.",
  ],
  [
    "Is this an AI tool?",
    "It’s a strategy engine built by 11 people over 1,550+ hours. AI only helps polish the output. The thinking comes from us.",
  ],
  [
    "What’s a 7-day strategy?",
    "A clear plan for one week: what to stop, what to start, what to do each day, and the angle that’s only yours.",
  ],
  [
    "Will my plan look like everyone else’s?",
    "No. It starts from your business, your rivals and your market, so it can’t be anyone else’s.",
  ],
  [
    "Who is it for?",
    "Founders in fashion, food and beverage, and beauty and personal care. If you’re in something else, join anyway and tell us.",
  ],
  ["How much does it cost?", "Joining the waitlist is free. We’ll share pricing before launch."],
  [
    "When do I get access?",
    "When the version for your industry is ready, we’ll email you. We may ask for honest feedback in return.",
  ],
];

function FaqSection() {
  return (
    <section className="nw-sec" id="faq" aria-labelledby="faq-h">
      <div className="nw-wrap nw-faq-wrap">
        <h2 className="nw-h2" id="faq-h" data-reveal>
          FAQ
        </h2>
        <div className="nw-faq" data-reveal>
          {FAQS.map(([q, a]) => (
            <details key={q} name="nw-faq">
              <summary>
                {q}
                <span className="nw-plus" aria-hidden="true" />
              </summary>
              <div className="nw-ans">
                <p>{a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final call to action ─── */

function CtaSection() {
  const { me } = useWaitlistGame();
  const [ctaRef, drawn] = useSeen<HTMLElement>();
  return (
    <section ref={ctaRef} className={`nw-cta${drawn ? " nw-drawn" : ""}`} id="cta" aria-labelledby="cta-h">
      <div className="nw-wrap nw-center nw-cta-in">
        <Image
          src="/loopy-cutout.webp"
          alt=""
          width={283}
          height={360}
          sizes="120px"
          className="nw-cta-loopy"
          data-reveal
        />
        <div className="nw-cta-head">
          <svg className="nw-loop-circle" viewBox="0 0 200 200" aria-hidden="true">
            <circle pathLength={1} cx="100" cy="100" r="94" transform="rotate(-90 100 100)" />
          </svg>
          <h2 className="nw-h2" id="cta-h" data-reveal>
            {me ? `You’re on the list, ${me.firstName}.` : "Your brand is worth a real plan."}
          </h2>
        </div>
        {me ? (
          <p className="nw-sub nw-cta-sub" data-reveal>
            We’ll email <span className="nw-strong">{me.email}</span> when your <span className="nw-nowrap">7-day</span>{" "}
            strategy is ready.
          </p>
        ) : (
          <>
            <p className="nw-sub nw-cta-sub" data-reveal>
              Join the waitlist and get your first <span className="nw-nowrap">7-day</span> strategy when we launch.
            </p>
            <div className="nw-actions" data-reveal>
              <JoinButton />
            </div>
            <p className="nw-small nw-muted" data-reveal>
              No spam. Just your invite when it’s ready.
            </p>
          </>
        )}
        <div className="nw-social" data-reveal>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Loop Launch on Instagram">
            <InstagramIcon />
          </a>
          <a href={`mailto:${siteConfig.links.contact}`} aria-label={`Email ${siteConfig.links.contact}`}>
            <Mail size={20} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

/** Lucide dropped its brand icons, so Instagram is drawn here in the same 24px stroke style. */
function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

/* ─── Footer ─── */

/** The waitlist page's footer. Log in stays here for the team, since the nav has none while invite-only. */
export function WaitlistFooter() {
  const email = siteConfig.links.contact;
  return (
    <footer className="nw nw-foot">
      <div className="nw-wrap">
        <div className="nw-foot-row">
          <div className="nw-foot-brand">
            <Image src="/logo.png" alt="Loop Launch" width={97} height={32} />
            <p>Your virtual CMO. The CMO you couldn’t afford.</p>
          </div>
          <nav className="nw-foot-links" aria-label="Footer">
            <a href="#how" onClick={(e) => jumpTo(e, "how")}>
              How it works
            </a>
            <a href="#faq" onClick={(e) => jumpTo(e, "faq")}>
              FAQ
            </a>
            <a href={`mailto:${email}`}>Contact</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/login">Log in (invite only)</Link>
          </nav>
        </div>
        <div className="nw-foot-row nw-foot-row2">
          <p>© {new Date().getFullYear()} Loop Launch.</p>
          <p>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagram @looplaunch.in
            </a>{" "}
            <span aria-hidden="true">·</span> <a href={`mailto:${email}`}>{email}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Phones: a join button pinned to the bottom once the hero is gone, until the final call to action ─── */

export function StickyJoin() {
  const { me, openGame } = useWaitlistGame();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-section");
    const cta = document.getElementById("cta");
    if (!hero || !cta) return;
    let heroGone = false;
    let ctaIn = false;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) heroGone = !entry.isIntersecting;
        else ctaIn = entry.isIntersecting;
      }
      setShow(heroGone && !ctaIn);
    });
    io.observe(hero);
    io.observe(cta);
    return () => io.disconnect();
  }, []);

  if (me) return null;
  return (
    <button
      type="button"
      className={`nw-sticky${show ? " nw-show" : ""}`}
      onClick={() => openGame()}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      Join the waitlist
    </button>
  );
}
