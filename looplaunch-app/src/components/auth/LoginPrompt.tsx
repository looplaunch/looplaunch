"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Mail, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
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
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-prompt-title"
            className="relative w-full max-w-sm rounded-2xl bg-[#0D0D10] border border-[#27272A] p-6 shadow-2xl"
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
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#17171B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <LoopyMascot size={64} mood="wave" />
              <h2 id="login-prompt-title" className="mt-3 text-[17px] font-semibold text-[#F4F4F5]">
                {title}
              </h2>
              <p className="mt-1.5 text-[13px] text-[#A1A1AA] leading-relaxed">{description}</p>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={busy}
                autoFocus
                className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-white text-[#09090B] font-medium text-sm py-2.5 hover:bg-[#F4F4F5] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[#27272A] bg-[#141418] text-[#F4F4F5] font-medium text-sm py-2.5 hover:border-[#3F3F46] hover:bg-[#18181D] transition-colors"
              >
                <Mail className="w-4 h-4 text-[#A1A1AA]" />
                Continue with email
              </Link>
            </div>

            {error && <p className="mt-3 text-center text-[12px] text-[#F87171]">{error}</p>}

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-1 text-[12px] text-[#71717A] hover:text-[#A1A1AA] cursor-pointer"
            >
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
