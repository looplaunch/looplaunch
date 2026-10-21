"use client";

import { useEffect, useRef, useState } from "react";
import RotatingText from "@/components/ui/RotatingText";
import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const STRATEGY_STEPS = [
  {
    num: "01",
    title: "Understand",
    description: "Your company, product, positioning and audience.",
  },
  {
    num: "02",
    title: "Research",
    description: "Your market, customers and competitors.",
  },
  {
    num: "03",
    title: "Identify",
    description: "Gaps, opportunities and strategic advantages.",
  },
  {
    num: "04",
    title: "Build",
    description: "A focused strategy and actionable intelligence.",
  },
];

export function WhatIsLoopLaunchSection() {
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
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="what-is-it"
      ref={sectionRef}
      className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
        {/* Left Column: Editorial Statement */}
        <div
          className={`lg:col-span-6 space-y-6 transition-all duration-700 ${isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
            }`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary leading-[1.2] flex items-center">
            <RotatingText
              texts={["Understand", "Research", "Identify", "Build"]}
              mainClassName="px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 md:py-2 bg-white text-black font-medium rounded-xl inline-flex overflow-hidden justify-center items-center shadow-sm"
              staggerFrom="last"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2000}
            />
          </h2>

          <p className="text-text-secondary text-base sm:text-lg leading-relaxed max-w-lg font-normal">
            Loop Launch studies your company, market and competitive landscape
            before making strategic recommendations.
          </p>

          <p className="text-text-tertiary text-sm sm:text-base leading-relaxed max-w-lg font-normal">
            Rather than generic advice, our framework continuously cross-references
            internal realities with live market dynamics to identify where your
            distinct advantages truly lie.
          </p>
        </div>

        {/* Right Column: How Loop Launch thinks (Strategic Framework) */}
        <div
          className={`lg:col-span-6 transition-all duration-700 delay-150 ${isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
            }`}
        >
          <div className="text-xs uppercase tracking-widest text-text-tertiary font-medium mb-6">
            How Loop Launch thinks
          </div>

          <StaggerContainer staggerDelay={0.1} className="space-y-3">
            {STRATEGY_STEPS.map((step) => (
              <StaggerItem key={step.num}>
                <SpotlightCard
                  className="p-5 sm:p-6 bg-bg-surface border border-border-subtle hover:border-[#8B5CF6]/40 transition-colors"
                  radius={320}
                  surfaceGlow="rgba(255, 255, 255, 0.02)"
                  borderGlow="rgba(139, 92, 246, 0.25)"
                >
                  <div className="flex items-baseline gap-5 sm:gap-7">
                    <span className="font-mono text-xs text-[#8B5CF6] font-semibold w-6">
                      {step.num}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-medium text-text-primary mb-1">
                        {step.title}
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed font-normal">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </SpotlightCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>
    </section>
  );
}
