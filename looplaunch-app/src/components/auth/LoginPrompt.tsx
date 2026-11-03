"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Mail, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { PRIMARY, SECONDARY, TEXT_LINK } from "@/components/ui/fields";
import { startGoogleSignIn } from "@/lib/auth/google";

interface LoginPromptProps {
  open: boolean;
  onClose: () => void;
  /** Where to come back to after logging in (same-site path). */
  next: string;
  title: string;
  description: ReactNode;
}

const noopSubscribe = () => () => {};

/**
 * Pop-up asking a signed-out visitor to log in before they can go on.
 * Portalled to <body>, like LogoMenu, so a blurred header can't trap the fixed overlay.
 */
export function LoginPrompt({ open, onClose, next, title, description }: LoginPromptProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const continueWithGoogle = async () => {
    setError("");
    setBusy(true);
    const message = await startGoogleSignIn(next);
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-prompt-title"
            className="relative w-full max-w-[400px] rounded-[20px] bg-[#111114] p-6 sm:p-7"
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <LoopyMascot size={56} />
              <h2 id="login-prompt-title" className="mt-3 text-[20px] leading-tight font-semibold text-[#F4F4F5]">
                {title}
              </h2>
              <p className="mt-2 text-[14px] text-[#B4B4BC] leading-relaxed">{description}</p>
            </div>

            <div className="mt-6 space-y-2.5">
              <button type="button" onClick={continueWithGoogle} disabled={busy} autoFocus className={`${PRIMARY} inline-flex items-center justify-center gap-2.5`}>
                <GoogleIcon />
                {busy ? "Opening Google…" : "Continue with Google"}
              </button>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className={SECONDARY}>
                <Mail className="w-4 h-4 text-[#B4B4BC]" aria-hidden="true" />
                Continue with email
              </Link>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-center text-[13px] text-[#F87171]">
                {error}
              </p>
            )}

            <button type="button" onClick={onClose} className={`${TEXT_LINK} mt-4 w-full py-1`}>
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
