"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tip } from "@/components/ui/Tip";
import { toast } from "@/lib/toast";

interface DeleteAnalysisButtonProps {
  sessionId: string;
  companyName: string;
  className?: string;
}

/** Trash button on a History card: asks first, then deletes the analysis and its chat. */
export function DeleteAnalysisButton({ sessionId, companyName, className = "" }: DeleteAnalysisButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/intelligence/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setError(data?.error || "Couldn't delete this analysis. Please try again.");
      setBusy(false);
      return;
    }
    setOpen(false);
    setBusy(false);
    toast(`${companyName} deleted`, { description: "The analysis and its chat are gone from your History." });
    router.refresh();
  };

  return (
    <>
      <span className={className}>
        <Tip label="Delete analysis">
          <button
            type="button"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
            aria-label={`Delete the analysis of ${companyName}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-[#F87171] hover:bg-[#7F1D1D]/25 active:scale-90 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tip>
      </span>
      <ConfirmDialog
        open={open}
        title={`Delete ${companyName}?`}
        description="This removes the analysis and its chat from your History for good."
        confirmLabel="Delete"
        busy={busy}
        error={error}
        onConfirm={remove}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
