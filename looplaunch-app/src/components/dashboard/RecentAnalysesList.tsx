"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AnimatedList from "@/components/reactbits/AnimatedList";
import { AnalysisStatusMark } from "@/components/app/AnalysisStatusMark";
import { openHref, statusText, timeAgo } from "@/components/app/AnalysisRow";
import { PipelineStrip } from "./PipelineStrip";
import { displayDomain, type SessionSummary } from "@/lib/intelligence/summary";

/** The tiles take the app's flat surfaces instead of the component's own gradient and rim. */
const FLAT_TILES = {
  "--al-tile": "#1C1C21",
  "--al-tile-shadow": "none",
  "--al-tile-edge": "transparent",
  "--al-tile-highlight": "transparent",
  "--al-hover": "brightness(1.18)",
  "--al-active": "brightness(1.18)",
} as CSSProperties;

/**
 * Earlier analyses on the dashboard (React Bits AnimatedList): rows spring in one after another,
 * a ring glides to the row under the pointer or the arrow keys, and Enter or a click opens it.
 */
export function RecentAnalysesList({ sessions }: { sessions: SessionSummary[] }) {
  const router = useRouter();

  return (
    <AnimatedList
      items={sessions.map((s) => ({ id: s.id, title: s.companyName }))}
      onItemSelect={(_, index) => router.push(openHref(sessions[index]))}
      renderItem={(_, index) => {
        const s = sessions[index];
        const st = statusText(s);
        return (
          <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-4">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium truncate">{s.companyName}</span>
              <span className="block text-[12px] text-[#8B8B94] truncate">
                {[displayDomain(s.website), s.industry].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="hidden sm:block">
              <PipelineStrip status={s.status} />
            </span>
            <span className="text-right">
              <span className={`flex items-center justify-end gap-1.5 text-[12px] font-medium ${st.tone}`}>
                <AnalysisStatusMark status={s.status} delay={300 + index * 90} />
                {st.label}
              </span>
              <span className="block text-[12px] text-[#8B8B94] tabular-nums">{timeAgo(s.updatedAt)}</span>
            </span>
          </span>
        );
      }}
      selectOnHover
      enableArrowNavigation
      animation="slide"
      stagger={0.07}
      showGradients={false}
      frame={false}
      radius={14}
      gap={8}
      width="100%"
      maxHeight="none"
      accentColor="#8B5CF6"
      style={FLAT_TILES}
      itemClassName="min-h-[63px] !px-4"
    />
  );
}
