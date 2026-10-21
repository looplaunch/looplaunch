"use client";

import { useEffect, useRef, useState } from "react";
import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const RESEARCH_AREAS = [
  {
    title: "Company",
    description:
      "Understand your product architecture, brand positioning, audience perception and core value propositions.",
    items: [
      "Product & feature architecture",
      "Current positioning & perceived category",
      "Core messaging & value proposition",
      "Target customer profiles",
      "Active acquisition channels",
      "Content & narrative tone",
    ],
  },
  {
    title: "Market",
    description:
      "Map category dynamics, customer hesitation triggers, demand shifts and burgeoning opportunities.",
    items: [
      "Emerging industry shifts",
      "Customer decision friction",
      "Organic demand & search patterns",
      "Unaddressed category gaps",
      "Pricing expectations",
    ],
  },
  {
    title: "Competitors",
    description:
      "Identify competitor claims, pricing structures, acquisition channels and clear differentiation wedges.",
    items: [
      "Direct & indirect positioning",
      "Pricing & packaging models",
      "Core promises & ad messaging",
      "Lead generation mechanics",
      "Defensible differentiation",
    ],
  },
];

export function DeepResearchSection() {
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

  return (
    <section
      ref={sectionRef}
      className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary"
    >
      <div className="max-w-6xl mx-auto">
        {/* Editorial Header */}
        <div className="max-w-2xl mb-24">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]">
            Research before recommending.
          </h2>
          <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed font-normal">
            Loop Launch studies your company, market and competitive landscape
            before making strategic recommendations.
          </p>
        </div>

        {/* 3 Editorial Columns with Staggered Entrance & Cursor Glow */}
        <StaggerContainer
          staggerDelay={0.12}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
        >
          {RESEARCH_AREAS.map((area) => (
            <StaggerItem key={area.title} className="h-full">
              <SpotlightCard
                className="h-full p-7 sm:p-8 bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-[#8B5CF6]/40 transition-colors flex flex-col justify-between"
                radius={320}
                surfaceGlow="rgba(255, 255, 255, 0.02)"
                borderGlow="rgba(139, 92, 246, 0.25)"
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-text-primary mb-3">
                    {area.title}
                  </h3>

                  <p className="text-sm text-text-secondary leading-relaxed mb-8 font-normal">
                    {area.description}
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-border-subtle">
                    {area.items.map((item) => (
                      <div
                        key={item}
                        className="text-xs sm:text-sm text-text-secondary flex items-baseline gap-2.5"
                      >
                        <span className="text-[#8B5CF6] font-medium">&ndash;</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
