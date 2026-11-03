import { PIPELINE_STAGES, stagesDone } from "@/lib/intelligence/summary";
import type { PipelineStatus } from "@/lib/intelligence/types";

interface PipelineStripProps {
  /** Omit to show the stages without progress (the new-user preview) */
  status?: PipelineStatus;
  /** Print the stage names under the bars */
  labelled?: boolean;
}

/**
 * The four research stages as a strip of bars: purple when finished, grey when not.
 * The one place the brand purple sits on data, so finished work reads at a glance.
 */
export function PipelineStrip({ status, labelled = false }: PipelineStripProps) {
  const done = status ? stagesDone(status) : 0;
  const failed = status === "error";

  return (
    <ol
      className="grid grid-cols-4 gap-1.5"
      aria-label={status ? `Research progress: ${done} of ${PIPELINE_STAGES.length} stages finished` : "Research stages"}
    >
      {PIPELINE_STAGES.map((stage, i) => {
        const finished = i < done;
        const current = !failed && status && status !== "ready" && i === done;
        return (
          <li key={stage} className="min-w-0">
            <span
              aria-hidden="true"
              className={`block h-1 rounded-full ${
                finished ? "bg-[#8B5CF6]" : current ? "bg-[#8B5CF6]/40" : "bg-[#2A2A30]"
              }`}
            />
            {labelled ? (
              <span className={`block mt-2 text-[12px] leading-4 ${finished || !status ? "text-[#D4D4D8]" : "text-[#8B8B94]"}`}>
                {stage}
              </span>
            ) : (
              <span className="sr-only">
                {stage}: {finished ? "done" : current ? "in progress" : "not started"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
