"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import HoldButton from "@/components/reactbits/HoldButton";

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

/**
 * "Are you sure?" pop-up for destructive actions. Portalled to <body> like the other pop-ups.
 * The action button must be held down (React Bits HoldButton): a red fill rises while it is held
 * and drains away if it is let go early, so a stray click can't delete anything.
 */
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
  const [tapped, setTapped] = useState(false);
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        setTyped("");
        setTapped(false);
      }}
    >
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onClose()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-[400px] rounded-[20px] bg-[#111114] p-6"
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-[18px] leading-snug font-semibold text-[#F4F4F5]">
              {title}
            </h2>
            <div className="mt-2 text-[14px] text-[#B4B4BC] leading-relaxed">{description}</div>

            {requireText && (
              <label className="block mt-5">
                <span className="block text-[14px] font-medium text-[#D4D4D8] mb-2">
                  Type <span className="font-semibold text-[#F4F4F5]">{requireText}</span> to confirm
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  className="w-full h-10 rounded-[10px] bg-[#1C1C21] border border-[#2E2E35] hover:border-[#3F3F48] px-3.5 text-[15px] text-[#F4F4F5] outline-none focus:border-[#F87171] transition-colors"
                />
              </label>
            )}

            {tapped && !error && (
              <p className="mt-3 text-[13px] text-[#FCA5A5]">Keep holding the button until it fills.</p>
            )}

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-[#F87171]">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                autoFocus={!requireText}
                className="h-10 px-5 rounded-full bg-[#1C1C21] border border-[#2E2E35] hover:border-[#3F3F48] hover:bg-[#222228] text-[14px] font-medium text-[#F4F4F5] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Cancel
              </button>
              <HoldButton
                onHold={onConfirm}
                onTap={() => setTapped(true)}
                disabled={busy || !ready}
                holdTime={1100}
                resetAfter={1600}
                size="sm"
                radius={999}
                glow={false}
                backgroundColor="#2A1215"
                fillColor="#DC2626"
                textColor="#FCA5A5"
                fillTextColor="#FFFFFF"
                doneLabel="Deleting…"
                className="!h-10 !px-5 !text-[14px] font-semibold"
              >
                Hold to {confirmLabel.charAt(0).toLowerCase() + confirmLabel.slice(1)}
              </HoldButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
