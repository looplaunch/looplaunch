"use client";

import { useEffect, useRef, useState } from "react";
import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const STAGES = [
  {
    num: "01",
    title: "Research",
    description:
      "Continuous synthesis across your company, category trends and competitors.",
  },
  {
    num: "02",
    title: "Diagnosis",
    description:
      "Uncovering root friction points, messaging fatigue and positioning gaps.",
  },
  {
    num: "03",
    title: "Opportunity",
    description:
      "Pinpointing uncontested market whitespace where your business has natural leverage.",
  },
  {
    num: "04",
    title: "Strategy",
    description:
      "Translating opportunities into a definitive positioning wedge and channel playbook.",
  },
];

export function StrategicIntelligenceSection() {
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
      ref={sectionRef}
      className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary"
    >
      <div className="max-w-6xl mx-auto">
        {/* Editorial Header */}
        <div className="max-w-2xl mb-24">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.12]">
            Find where you can win.
          </h2>
          <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed font-normal">
            Information is useful. Direction is everything.
          </p>
        </div>

        {/* 4 Clean Strategic Stages with Staggered Entrance & Cursor Glow */}
        <StaggerContainer
          staggerDelay={0.09}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
        >
          {STAGES.map((stage) => (
            <StaggerItem key={stage.title} className="h-full">
              <SpotlightCard
                className="h-full p-6 sm:p-7 bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-[#8B5CF6]/40 transition-colors flex flex-col justify-between"
                radius={320}
                surfaceGlow="rgba(255, 255, 255, 0.02)"
                borderGlow="rgba(139, 92, 246, 0.25)"
              >
                <div>
                  <div className="text-xs font-mono text-[#8B5CF6] font-semibold mb-4">
                    {stage.num}
                  </div>
                  <h3 className="text-xl font-medium tracking-tight text-text-primary mb-2">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed font-normal">
                    {stage.description}
                  </p>
                </div>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
