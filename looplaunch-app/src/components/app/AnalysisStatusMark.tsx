"use client";

import { useEffect, useState } from "react";
import StatusMark from "@/components/reactbits/StatusMark";
import { stagesDone, type SessionSummary } from "@/lib/intelligence/summary";

type Mark = "running" | "done" | "failed";

/**
 * The status glyph (React Bits StatusMark): a ring that fills as the research runs, then a tick or a
 * cross. It arrives as an empty ring and plays to its real state, so the tick is drawn where you see it.
 */
export function AnalysisStatusMark({ status, size = 14, delay = 200 }: { status: SessionSummary["status"]; size?: number; delay?: number }) {
  const mark: Mark = status === "ready" ? "done" : status === "error" ? "failed" : "running";
  const progress = mark === "running" ? Math.max(0.08, stagesDone(status) / 4) : undefined;
  const [shown, setShown] = useState<{ mark: Mark; progress?: number }>({ mark: "running", progress: 0.02 });

  useEffect(() => {
    const timer = setTimeout(() => setShown({ mark, progress }), delay);
    return () => clearTimeout(timer);
  }, [mark, progress, delay]);

  return (
    <StatusMark
      status={shown.mark}
      progress={shown.mark === "running" ? shown.progress : undefined}
      size={size}
      color="#FBBF24"
      doneColor="#8B5CF6"
      errorColor="#F87171"
    />
  );
}
