"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label={`Delete the analysis of ${companyName}`}
        title="Delete analysis"
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F87171] hover:bg-[#7F1D1D]/20 transition-colors cursor-pointer ${className}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
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
