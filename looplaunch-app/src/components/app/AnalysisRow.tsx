import Link from "next/link";
import { PipelineStrip } from "@/components/dashboard/PipelineStrip";
import { AnalysisStatusMark } from "./AnalysisStatusMark";
import { displayDomain, type SessionSummary } from "@/lib/intelligence/summary";
import { DeleteAnalysisButton } from "./DeleteAnalysisButton";

export { AnalysisStatusMark };

export function timeAgo(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function statusText(s: SessionSummary): { label: string; tone: string } {
  if (s.status === "ready") return { label: "Strategy ready", tone: "text-[#F4F4F5]" };
  if (s.status === "error") return { label: "Didn't finish", tone: "text-[#F87171]" };
  return { label: "Researching", tone: "text-[#FBBF24]" };
}

export const openHref = (s: SessionSummary) => `/intelligence?session=${encodeURIComponent(s.id)}`;

/** Column widths shared by the History header row and its rows. */
export const HISTORY_COLUMNS = "sm:grid-cols-[minmax(0,1fr)_120px_76px_112px]";

interface AnalysisRowProps {
  session: SessionSummary;
  /** History: adds the question count, the last question and the delete button */
  detailed?: boolean;
}

/**
 * One analysis as a row; the whole row opens it. The delete button sits beside the link, since a button can't go inside one.
 * On a phone the status and date move under the name, so a long name isn't cut short to make room for them.
 */
export function AnalysisRow({ session: s, detailed = false }: AnalysisRowProps) {
  const st = statusText(s);
  const columns = detailed ? HISTORY_COLUMNS : "sm:grid-cols-[minmax(0,1fr)_120px_96px]";

  return (
    <div className="group relative">
      <Link
        href={openHref(s)}
        className={`grid grid-cols-1 ${columns} items-center gap-x-4 min-h-[63px] rounded-[14px] bg-[#1C1C21] px-4 py-3 sm:py-2.5 hover:bg-[#232329] focus-visible:bg-[#232329] transition-colors ${
          detailed ? "pr-14" : ""
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium truncate">{s.companyName}</span>
          <span className="block text-[12px] text-[#8B8B94] truncate">
            {[displayDomain(s.website), s.industry].filter(Boolean).join(" · ")}
          </span>
          {detailed && s.lastQuestion && (
            <span className="block mt-1 text-[13px] text-[#B4B4BC] truncate">Last asked: {s.lastQuestion}</span>
          )}
        </span>
        <span className="hidden sm:block">
          <PipelineStrip status={s.status} />
        </span>
        {detailed && (
          <span className="hidden sm:block text-right text-[13px] text-[#B4B4BC] tabular-nums">
            {s.questionCount || "—"}
            <span className="sr-only"> questions asked</span>
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-2.5 sm:mt-0 sm:block sm:text-right">
          <span className={`flex items-center sm:justify-end gap-1.5 text-[12px] font-medium ${st.tone}`}>
            <AnalysisStatusMark status={s.status} />
            {st.label}
          </span>
          <span className="sm:block text-[12px] text-[#8B8B94] tabular-nums">{timeAgo(s.updatedAt)}</span>
        </span>
      </Link>
      {detailed && (
        <DeleteAnalysisButton
          sessionId={s.id}
          companyName={s.companyName}
          className="absolute right-2 top-1/2 -translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100"
        />
      )}
    </div>
  );
}
