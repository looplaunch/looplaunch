"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  /** Error to show inside the dialog, e.g. when the action failed */
  error?: string;
  /** For actions that can't be undone: the person must type this word to enable the button */
  requireText?: string;
}

const noopSubscribe = () => () => {};

/** "Are you sure?" pop-up for destructive actions. Portalled to <body> like the other pop-ups. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  error,
  requireText,
}: ConfirmDialogProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [typed, setTyped] = useState("");
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence onExitComplete={() => setTyped("")}>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-2xl bg-[#0D0D10] border border-[#27272A] p-6 shadow-2xl"
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-[16px] font-semibold text-[#F4F4F5]">
              {title}
            </h2>
            <div className="mt-2 text-[13px] text-[#A1A1AA] leading-relaxed">{description}</div>

            {requireText && (
              <label className="block mt-4">
                <span className="block text-[12px] text-[#A1A1AA] mb-1.5">
                  Type <span className="font-semibold text-[#F4F4F5]">{requireText}</span> to confirm
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  className="w-full rounded-lg bg-[#09090B] border border-[#27272A] px-3.5 py-2.5 text-sm text-[#F4F4F5] focus:outline-none focus:border-[#F87171] transition-colors"
                />
              </label>
            )}

            {error && <p className="mt-3 text-[12px] text-[#F87171]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                autoFocus={!requireText}
                className="px-4 py-2 rounded-lg border border-[#3F3F46] text-sm font-medium text-[#F4F4F5] hover:bg-[#17171B] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy || !ready}
                className="px-4 py-2 rounded-lg bg-[#DC2626] text-sm font-medium text-white hover:bg-[#B91C1C] disabled:opacity-40 transition-colors cursor-pointer"
              >
                {busy ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
