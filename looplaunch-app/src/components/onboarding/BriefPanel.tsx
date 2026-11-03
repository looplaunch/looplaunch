"use client";

import { Check } from "lucide-react";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { displayDomain } from "@/lib/intelligence/summary";
import { STEPS, type OnboardingData, type StepKey } from "@/lib/onboarding/types";

/** Short names for the brief, in question order. */
const BRIEF_LABELS: Partial<Record<StepKey, string>> = {
  website: "Website",
  role: "Your role",
  industry: "Industry",
  stage: "Stage",
  coreOffer: "What you sell",
  audience: "Who buys",
  salesChannels: "Where you sell",
  biggestHeadache: "Biggest headache",
  thirtyDayGoal: "30-day goal",
};

/** The visitor's own answers, filling in as they go: what the research will be built from. */
export function BriefPanel({ data, currentKey }: { data: OnboardingData; currentKey: StepKey }) {
  const steps = STEPS.filter((s) => s.field);
  const answered = steps.filter((s) => {
    const v = data[s.field!];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;

  return (
    <div data-ui className="rounded-2xl bg-[#111114] border border-[#27272A] p-5 max-w-[560px] lg:ml-auto">
      <div className="flex items-center gap-3">
        <LoopyMascot size={40} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#F4F4F5]">Your brief</p>
          <p className="text-[13px] text-[#B4B4BC] truncate">
            {data.website ? `For ${displayDomain(data.website)}` : "The research is built from these answers"}
          </p>
        </div>
        <span className="ml-auto text-[13px] text-[#B4B4BC] tabular-nums shrink-0">
          {answered} of {steps.length}
        </span>
      </div>

      <ol className="mt-4 divide-y divide-[#1F1F24]">
        {steps.map((s) => {
          const raw = data[s.field!];
          const value = Array.isArray(raw) ? raw.join(", ") : raw;
          const current = s.key === currentKey;
          return (
            <li key={s.key} className="flex items-center gap-3 py-2.5 min-h-[44px]">
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
                  value ? "bg-[#8B5CF6] text-white" : current ? "border-2 border-[#8B5CF6]" : "border border-[#3F3F48]"
                }`}
                aria-hidden="true"
              >
                {value && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
              <span className={`text-[14px] w-[132px] shrink-0 ${current ? "text-[#F4F4F5] font-medium" : "text-[#B4B4BC]"}`}>
                {BRIEF_LABELS[s.key]}
              </span>
              <span className={`text-[14px] min-w-0 truncate ${value ? "text-[#F4F4F5]" : "text-[#8B8B94]"}`}>
                {value ? (s.key === "website" ? displayDomain(value) : value) : current ? "Answering now" : "—"}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 pt-4 border-t border-[#1F1F24]">
        <p className="text-[13px] text-[#B4B4BC] mb-3">Then the research runs, in four stages</p>
        <PipelineStrip labelled />
      </div>
    </div>
  );
}
