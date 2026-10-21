"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const STRATEGY_DELIVERABLES = [
  {
    id: "diagnosis",
    label: "Diagnosis",
    title: "Strategic Diagnosis",
    summary:
      "Clarifying where your positioning currently loses momentum and where your product holds natural category leverage.",
    points: [
      "Address positioning ambiguity across initial touchpoints",
      "Lead with concrete business outcomes rather than feature lists",
      "Counter-position directly against bloated legacy incumbents",
    ],
  },
  {
    id: "positioning",
    label: "Positioning",
    title: "Category Positioning",
    summary:
      "Defining your defensible market wedge and category stance.",
    points: [
      "Frame the product as an indispensable operating system, not a point solution",
      "Claim the high-speed category territory that competitors cannot fulfill",
      "Anchor the narrative around verified accuracy and execution speed",
    ],
  },
  {
    id: "audience",
    label: "Audience",
    title: "Ideal Customer Profile",
    summary:
      "High-conviction buyer definition, decision triggers, and urgent pain points.",
    points: [
      "Primary buyer: Technical founders, operators and growth leaders",
      "Key trigger: Need for strategic clarity without prolonged agency overhead",
      "Buying hesitation: Skepticism of unverified generative content",
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    title: "Messaging Architecture",
    summary:
      "Clear, persuasive narrative hooks and objection-handling language.",
    points: [
      "Concise, non-corporate value proposition statements",
      "Direct hooks addressing founder-level strategic pain",
      "Transparent proof points grounded in real market data",
    ],
  },
  {
    id: "channels",
    label: "Channels",
    title: "Growth Channels",
    summary:
      "Prioritized distribution vectors ranked by efficiency and leverage.",
    points: [
      "High-intent organic search focused on competitor comparisons",
      "Targeted direct outreach to high-fit ICP accounts",
      "Shareable teardown tools that turn users into brand advocates",
    ],
  },
  {
    id: "qa",
    label: "Strategic Q&A",
    title: "Interactive Strategy Advisory",
    summary:
      "Ask specific marketing questions and receive synthesized recommendations grounded in your company, competitor, and market data.",
    points: [
      "Interrogate competitor moats and find exploitable positioning weaknesses",
      "Stress-test pricing, messaging angles, and channel distribution",
      "Get concrete next experiments, hypotheses, and proof points",
    ],
  },
];

export function StrategyOutputSection() {
  const [activeTab, setActiveTab] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentItem = STRATEGY_DELIVERABLES[activeTab];

  return (
    <section
      id="strategy-output"
      ref={sectionRef}
      className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary"
    >
      <div className="max-w-6xl mx-auto">
        {/* Editorial Header */}
        <div className="max-w-2xl mb-24">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]">
            Turn insight into action.
          </h2>
          <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed font-normal">
            A clear, actionable strategy tailored specifically to your business.
          </p>
        </div>

        {/* Strategic Deliverable View with Spotlight Cursor Glow */}
        <SpotlightCard
          radius={360}
          surfaceGlow="rgba(255, 255, 255, 0.02)"
          borderGlow="rgba(139, 92, 246, 0.25)"
          className={`
            border border-border-subtle bg-bg-surface rounded-xl overflow-hidden
            transition-all duration-700
            ${isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
            }
          `}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
            {/* Left Nav */}
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-border-subtle p-4 sm:p-6 space-y-1">
              <div className="text-xs uppercase tracking-widest text-[#8B5CF6] font-semibold mb-4 px-3">
                Deliverables
              </div>
              {STRATEGY_DELIVERABLES.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(idx)}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer
                    ${activeTab === idx
                      ? "text-text-primary font-medium bg-bg-elevated border-l-2 border-[#8B5CF6]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40"
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Content Area with 200ms Crossfade + 8px Upward Slide */}
            <div className="md:col-span-8 p-6 sm:p-12 flex flex-col justify-start min-h-[460px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="w-full flex flex-col"
                >
                  <h3 className="text-2xl sm:text-3xl font-normal tracking-tight text-text-primary mb-4">
                    {currentItem.title}
                  </h3>

                  <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-8 font-normal">
                    {currentItem.summary}
                  </p>

                  <div className="space-y-3 pt-6 border-t border-border-subtle">
                    {currentItem.points.map((point, i) => (
                      <div
                        key={i}
                        className="text-sm sm:text-base text-text-secondary flex items-baseline gap-3"
                      >
                        <span className="text-[#8B5CF6] font-mono text-xs font-semibold">
                          0{i + 1}
                        </span>
                        <span className="font-normal">{point}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
