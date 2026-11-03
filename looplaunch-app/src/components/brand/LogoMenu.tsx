"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, Home, Plus, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { clearOnboardingProgress } from "@/lib/onboarding/context";
import { smoothScrollTo } from "@/lib/smooth-scroll";

interface LogoMenuProps {
  /** Extra line in the pop-up, e.g. a reminder that this analysis isn't saved */
  note?: ReactNode;
  /** Custom logo to click (defaults to Loopy + the small wordmark) */
  children?: ReactNode;
}

const noopSubscribe = () => () => {};

const OPTION =
  "group w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] bg-[#1C1C21] hover:bg-[#232329] active:scale-[0.99] text-left transition cursor-pointer";

/** The Loop Launch logo. Clicking it asks where to go: the home page, or a fresh analysis. */
export function LogoMenu({ note, children }: LogoMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Signed-out visitors answer the questions right on the landing page.
  const onLanding = pathname === "/" && !user;
  // The pop-up is portalled to <body>, so no header can trap the fixed overlay inside it.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const goHome = () => {
    setOpen(false);
    if (onLanding) smoothScrollTo("top");
    else router.push("/");
  };

  const startFresh = () => {
    clearOnboardingProgress();
    setOpen(false);
    const hero = document.getElementById("hero-section");
    if (onLanding && hero) smoothScrollTo(hero);
    else router.push("/new");
  };

  const options = [
    {
      icon: Home,
      title: "Go to home page",
      detail: user ? "Your dashboard and past analyses." : "Back to the Loop Launch home page.",
      onClick: goHome,
    },
    { icon: Plus, title: "Start a new analysis", detail: "A fresh page for a new website.", onClick: startFresh },
  ];

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logo-menu-title"
            className="relative w-full max-w-[400px] rounded-[20px] bg-[#111114] p-5 sm:p-6"
            initial={{ y: reduce ? 0 : 12, scale: reduce ? 1 : 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: reduce ? 0 : 8, scale: reduce ? 1 : 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pr-8">
              <LoopyMascot size={44} />
              <div>
                <h2 id="logo-menu-title" className="text-[18px] leading-tight font-semibold text-[#F4F4F5]">
                  Where to next?
                </h2>
                <p className="mt-0.5 text-[14px] text-[#B4B4BC]">Pick one and Loopy will take you there.</p>
              </div>
            </div>

            <div className="space-y-2">
              {options.map((o, i) => (
                <motion.button
                  key={o.title}
                  type="button"
                  onClick={o.onClick}
                  autoFocus={i === 0}
                  className={OPTION}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.06 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <o.icon className="w-4 h-4 text-[#B4B4BC] shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-[#F4F4F5]">{o.title}</span>
                    <span className="block text-[13px] text-[#B4B4BC] mt-0.5">{o.detail}</span>
                  </span>
                  <ArrowRight
                    className="w-4 h-4 text-[#8B8B94] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#F4F4F5]"
                    aria-hidden="true"
                  />
                </motion.button>
              ))}
            </div>

            {note && <div className="mt-4 text-[13px] text-[#B4B4BC] leading-relaxed">{note}</div>}
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
        className="flex items-center gap-2 rounded-lg hover:opacity-90 active:scale-[0.97] transition cursor-pointer"
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
