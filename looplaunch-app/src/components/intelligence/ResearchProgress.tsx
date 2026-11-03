"use client";

import { useState } from "react";
import { Building2, Globe, Lightbulb, PenLine, Search } from "lucide-react";
import CallChip, { type CallChipStatus } from "@/components/reactbits/CallChip";
import { stagesDone } from "@/lib/intelligence/summary";
import type { PipelineStatus } from "@/lib/intelligence/types";

interface ResearchProgressProps {
  /** The pipeline's status; undefined before the first poll answers */
  status?: PipelineStatus;
  /** The research is done and Loopy is writing the strategy */
  writing: boolean;
  companyName: string;
}

/**
 * The research as a column of tool chips (React Bits CallChip). The running one fills and keeps its
 * own clock; finished ones wash purple and take a tick; a failed stage shakes red.
 */
export function ResearchProgress({ status, writing, companyName }: ResearchProgressProps) {
  const done = status ? stagesDone(status) : 0;
  const failed = status === "error";

  const stages = [
    { icon: <Globe size={15} strokeWidth={1.8} />, name: "Read", argument: "the website", expectedMs: 25_000 },
    { icon: <Building2 size={15} strokeWidth={1.8} />, name: "Profile", argument: companyName, expectedMs: 20_000 },
    { icon: <Search size={15} strokeWidth={1.8} />, name: "Search Google", argument: "competitors · ads · questions", expectedMs: 70_000 },
    { icon: <Lightbulb size={15} strokeWidth={1.8} />, name: "Diagnose", argument: "where you can win", expectedMs: 30_000 },
  ];

  const stateOf = (i: number): CallChipStatus => {
    if (i < done) return "done";
    if (i === done) return failed ? "error" : status === "ready" ? "done" : "running";
    return "idle";
  };

  // A chip keeps a clock only once it has run while this page was open; stages finished before
  // the visit have no honest duration to show.
  const [watched, setWatched] = useState<number[]>([]);
  const runningNow = status ? [0, 1, 2, 3, 4].filter((i) => (i < 4 ? stateOf(i) === "running" : writing)) : [];
  const newlyRunning = runningNow.filter((i) => !watched.includes(i));
  if (newlyRunning.length) setWatched([...watched, ...newlyRunning]);

  return (
    <ol className="flex flex-col items-start gap-2" aria-label="Research progress">
      {stages.map((stage, i) => (
        <li key={stage.name}>
          <CallChip
            icon={stage.icon}
            name={stage.name}
            argument={stage.argument}
            status={stateOf(i)}
            expectedMs={stage.expectedMs}
            showTimer={watched.includes(i)}
            size={36}
            radius={12}
            color="#F4F4F5"
            surfaceColor="#1C1C21"
            progressColor="#8B5CF6"
            progressOpacity={0.22}
            doneColor="#A78BFA"
            errorColor="#F87171"
            className="max-w-full"
          />
        </li>
      ))}
      <li>
        <CallChip
          icon={<PenLine size={15} strokeWidth={1.8} />}
          name="Write"
          argument="your 7-day plan"
          status={writing ? "running" : "idle"}
          expectedMs={45_000}
          showTimer={watched.includes(4)}
          size={36}
          radius={12}
          color="#F4F4F5"
          surfaceColor="#1C1C21"
          progressColor="#8B5CF6"
          progressOpacity={0.22}
          doneColor="#A78BFA"
          errorColor="#F87171"
          className="max-w-full"
        />
      </li>
    </ol>
  );
}
