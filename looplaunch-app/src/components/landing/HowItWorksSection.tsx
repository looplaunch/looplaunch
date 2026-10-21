"use client";

import { useEffect, useRef, useState } from "react";
import TrueFocus from "@/components/ui/TrueFocus";
import { StaggerContainer, StaggerItem } from "@/components/ui/StaggerContainer";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const STEPS_DATA = [
  {
    num: "01",
    title: "Understand your company",
    description:
      "Study your core value proposition, audience perception, and current positioning.",
  },
  {
    num: "02",
    title: "Research your market",
    description:
      "Map category momentum, buyer hesitation points, and shifting customer expectations.",
  },
  {
    num: "03",
    title: "Analyze competitors",
    description:
      "Examine competitor positioning, messaging angles, and untapped market whitespace.",
  },
  {
    num: "04",
    title: "Identify opportunities",
    description:
      "Uncover where your business holds natural leverage and clear differentiation.",
  },
  {
    num: "05",
    title: "Build your strategy",
    description:
      "Shape a focused positioning foundation, audience profiles, and growth channel priorities.",
  },
  {
    num: "06",
    title: "Ask strategic questions",
    description:
      "Interrogate your intelligence, stress-test growth decisions, and get tailored strategic answers.",
  },
];

export function HowItWorksSection() {
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
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-32 sm:py-44 px-6 sm:px-8 border-b border-border-subtle bg-bg-primary text-text-primary"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mb-24">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]">
            <TrueFocus
              sentence="Our True|Focus"
              separator="|"
              manualMode={false}
              blurAmount={4}
              borderColor="#8B5CF6"
              glowColor="rgba(139, 92, 246, 0.4)"
              animationDuration={0.6}
              pauseBetweenAnimations={1.2}
            />
          </h2>
          <p className="mt-4 text-text-secondary text-base sm:text-lg max-w-lg leading-relaxed font-normal">
            A structured process that turns raw information into clear,
            actionable decisions.
          </p>
        </div>

        {/* 01 to 06 Editorial Grid with Staggered Entrance & Cursor Glow */}
        <StaggerContainer
          staggerDelay={0.09}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {STEPS_DATA.map((step) => (
            <StaggerItem key={step.num}>
              <SpotlightCard
                className="h-full p-6 sm:p-7 bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-[#8B5CF6]/40 transition-colors"
                radius={320}
                surfaceGlow="rgba(255, 255, 255, 0.02)"
                borderGlow="rgba(139, 92, 246, 0.25)"
              >
                {/* Step number */}
                <div className="text-xs text-[#8B5CF6] font-semibold mb-4 font-mono">
                  {step.num}
                </div>

                {/* Title */}
                <h3 className="text-lg sm:text-xl font-medium tracking-tight text-text-primary mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-text-secondary text-sm leading-relaxed font-normal">
                  {step.description}
                </p>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
