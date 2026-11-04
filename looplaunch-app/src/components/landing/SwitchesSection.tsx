"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const BANDS = [
  { id: "ads", line: "Watch every rival's Google ads.", note: "Up to 10 ads per analysis, straight from Google's Ads Transparency Center.", color: "#8B5CF6" },
  { id: "rivals", line: "Know who you're up against.", note: "Up to 10 competitors, each with a match score from 0 to 100.", color: "#10B981" },
  { id: "gap", line: "See the gap you can own.", note: "Where you are, where you should be, and what stands between.", color: "#FACC15" },
  { id: "ask", line: "Ask follow-ups, get sources.", note: "Every answer shows where it came from and how sure it is.", color: "#F4F4F5" },
];

/** What Loop Launch does, one sentence per band. Switching a band on fills it and states what you get. */
export function SwitchesSection() {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const sectionRef = useRef<HTMLElement>(null);
  const touched = useRef(false);

  // Two bands switch themselves on as the section arrives, a beat apart, so the move is seen.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        ["ads", "gap"].forEach((id, i) =>
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setOn((s) => ({ ...s, [id]: true }));
            }, 350 + i * 450)
          )
        );
      },
      { threshold: 0.35 }
    );
    io.observe(section);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section id="features" ref={sectionRef} aria-labelledby="features-title">
      <h2 id="features-title" className="sr-only-ll">
        What Loop Launch does for you
      </h2>
      {BANDS.map((band, i) => {
        const checked = Boolean(on[band.id]);
        return (
          <div
            key={band.id}
            className="ll-band"
            data-on={checked ? "" : undefined}
            style={{ "--band": band.color } as CSSProperties}
          >
            <span className="ll-band__fill" aria-hidden="true" />
            <div className="ll-wrap ll-grid ll-band__inner">
              <div className="ll-band__text" data-reveal style={{ "--d": `${i * 70}ms` } as CSSProperties}>
                <h3 id={`band-${band.id}`} className="ll-head">
                  {band.line}
                </h3>
                <div className="ll-band__note">
                  <span>
                    <p>{band.note}</p>
                  </span>
                </div>
              </div>
              <div className="ll-band__switch" data-ui>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-labelledby={`band-${band.id}`}
                  className="ll-switch"
                  onClick={() => {
                    touched.current = true;
                    setOn((s) => ({ ...s, [band.id]: !s[band.id] }));
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
