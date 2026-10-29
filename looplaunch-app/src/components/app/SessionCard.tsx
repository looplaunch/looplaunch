import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { displayDomain, type SessionSummary } from "@/lib/intelligence/summary";
import { DeleteAnalysisButton } from "./DeleteAnalysisButton";

export function timeAgo(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusOf(s: SessionSummary): { label: string; color: string } {
  if (s.status === "ready") return { label: "Strategy ready", color: "#34D399" };
  if (s.status === "error") return { label: "Didn't finish", color: "#F87171" };
  return { label: "Still researching", color: "#FBBF24" };
}

interface SessionCardProps {
  session: SessionSummary;
  /** Bigger card with an explicit "Open" call to action */
  featured?: boolean;
}

/**
 * One past analysis. Clicking it reopens the chat so the user can keep going.
 * The delete button sits beside the link, not in it (a button can't go inside a link).
 */
export function SessionCard({ session, featured = false }: SessionCardProps) {
  const status = statusOf(session);
  const domain = displayDomain(session.website);

  return (
    <div className="group relative">
      <Link
        href={`/intelligence?session=${encodeURIComponent(session.id)}`}
        className={`block rounded-2xl border border-[#27272A] bg-[#111114] hover:border-[#3F3F46] hover:bg-[#15151A] transition-colors pr-14 sm:pr-14 ${
          featured ? "p-5 sm:p-6" : "p-4"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-semibold text-[#F4F4F5] truncate ${featured ? "text-lg" : "text-[15px]"}`}>{session.companyName}</h3>
            {domain && domain !== session.companyName && <p className="text-[12px] text-[#71717A] truncate mt-0.5">{domain}</p>}
          </div>
          <span className="shrink-0 text-[12px] text-[#71717A]">{timeAgo(session.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-3 text-[12px] text-[#A1A1AA]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
          <span>{status.label}</span>
          {session.questionCount > 0 && (
            <>
              <span className="text-[#3F3F46]">·</span>
              <span>
                {session.questionCount} question{session.questionCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        {session.lastQuestion && (
          <p className={`mt-2 text-[#A1A1AA] line-clamp-2 ${featured ? "text-sm" : "text-[13px]"}`}>
            Last asked: &ldquo;{session.lastQuestion}&rdquo;
          </p>
        )}

        {featured && (
          <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-[#F4F4F5]">
            Open analysis
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </Link>
      <DeleteAnalysisButton
        sessionId={session.id}
        companyName={session.companyName}
        className="absolute right-3 top-1/2 -translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}
