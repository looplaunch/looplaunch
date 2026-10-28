"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Home, Plus, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { clearOnboardingProgress } from "@/lib/onboarding/context";

interface LogoMenuProps {
  /** Extra line in the pop-up, e.g. a reminder that this analysis isn't saved */
  note?: ReactNode;
  /** Custom logo to click (defaults to Loopy + the small wordmark) */
  children?: ReactNode;
}

const noopSubscribe = () => () => {};

const OPTION =
  "w-full flex items-start gap-3 p-3.5 rounded-xl border border-[#27272A] bg-[#141418] hover:border-[#3F3F46] hover:bg-[#18181D] text-left transition-colors cursor-pointer";

/** The Loop Launch logo. Clicking it asks where to go: the home page, or a fresh analysis. */
export function LogoMenu({ note, children }: LogoMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  // Signed-out visitors answer the questions right on the landing page.
  const onLanding = pathname === "/" && !user;
  // The pop-up is portalled to <body>: headers use backdrop-blur, which would trap a fixed overlay inside them.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const goHome = () => {
    setOpen(false);
    if (onLanding) window.scrollTo({ top: 0, behavior: "smooth" });
    else router.push("/");
  };

  const startFresh = () => {
    clearOnboardingProgress();
    setOpen(false);
    if (onLanding) document.getElementById("hero-section")?.scrollIntoView({ behavior: "smooth" });
    else router.push("/new");
  };

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logo-menu-title"
            className="relative w-full max-w-sm rounded-2xl bg-[#0D0D10] border border-[#27272A] p-5 shadow-2xl"
            initial={{ y: 12, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#17171B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <LoopyMascot size={44} mood="wave" />
              <div>
                <h2 id="logo-menu-title" className="text-[15px] font-semibold text-[#F4F4F5]">
                  Where to next?
                </h2>
                <p className="text-[12.5px] text-[#A1A1AA]">Pick one and Loopy will take you there.</p>
              </div>
            </div>

            <div className="space-y-2">
              <button type="button" onClick={goHome} className={OPTION} autoFocus>
                <span className="w-9 h-9 rounded-lg bg-[#1F1F24] flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4 text-[#F4F4F5]" />
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-[#F4F4F5]">Go to home page</span>
                  <span className="block text-[12px] text-[#A1A1AA] mt-0.5">
                    {user ? "Your dashboard and past analyses." : "Back to the Loop Launch home page."}
                  </span>
                </span>
              </button>
              <button type="button" onClick={startFresh} className={OPTION}>
                <span className="w-9 h-9 rounded-lg bg-[#8B5CF6] flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-white" />
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-[#F4F4F5]">Start a new analysis</span>
                  <span className="block text-[12px] text-[#A1A1AA] mt-0.5">A fresh page for a new website.</span>
                </span>
              </button>
            </div>

            {note && <div className="mt-3 text-[12px] text-[#A1A1AA] leading-relaxed">{note}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Loop Launch menu"
        className="flex items-center gap-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
      >
        {children ?? (
          <>
            <LoopyMascot size={28} mood="still" />
            <Image src="/logo.png" alt="Loop Launch" width={96} height={32} className="h-5 w-auto object-contain" priority />
          </>
        )}
      </button>
      {isClient && createPortal(dialog, document.body)}
    </>
  );
}
