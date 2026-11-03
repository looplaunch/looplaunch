"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { Clock, Home, LogOut, UserRound } from "lucide-react";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { profileOf, type ProfileInfo } from "@/lib/auth/profile";
import { Avatar } from "./Avatar";

interface AccountMenuProps {
  /** Profile from the server, so signed-in pages don't flash a placeholder */
  initialProfile?: ProfileInfo | null;
  /** Where "Log in" should bring people back to */
  loginNext?: string;
}

const ITEM =
  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] text-[#D4D4D8] hover:text-[#F4F4F5] hover:bg-[#1C1C21] transition-colors cursor-pointer";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The menu grows from the avatar's corner; its rows follow a beat behind. Leaving is quicker than arriving. */
const MENU: Variants = {
  closed: { opacity: 0, scale: 0.95, y: -6, transition: { duration: 0.14, ease: [0.55, 0.055, 0.675, 0.19] } },
  open: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT, staggerChildren: 0.03, delayChildren: 0.04 } },
};
const ROW: Variants = {
  closed: { opacity: 0, x: -4 },
  open: { opacity: 1, x: 0, transition: { duration: 0.18, ease: EASE_OUT } },
};

/** Avatar with a menu (profile, history, sign out) when signed in; a "Log in" link when not. */
export function AccountMenu({ initialProfile, loginNext }: AccountMenuProps) {
  const user = useAuthUser();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const profile = user === undefined ? initialProfile : user ? profileOf(user) : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (profile === undefined) return <span className="w-8 h-8 rounded-full bg-[#1C1C21]" aria-hidden="true" />;

  if (!profile) {
    return (
      <Link
        href={loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : "/login"}
        className="inline-flex items-center h-9 px-4 rounded-full text-[14px] font-medium text-[#D4D4D8] hover:text-[#F4F4F5] hover:bg-[#1C1C21] active:scale-[0.97] transition"
      >
        Log in
      </Link>
    );
  }

  const signOut = async () => {
    setOpen(false);
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className={`flex rounded-full ring-2 hover:ring-[#3F3F48] focus-visible:ring-[#8B5CF6] active:scale-95 transition cursor-pointer ${
          open ? "ring-[#3F3F48]" : "ring-transparent"
        }`}
      >
        <Avatar profile={profile} size={32} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            variants={MENU}
            initial={reduce ? false : "closed"}
            animate="open"
            exit={reduce ? undefined : "closed"}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full mt-2 w-64 z-50 rounded-2xl bg-[#111114] border border-[#1F1F24] shadow-[0_16px_48px_rgba(0,0,0,0.55)] p-1.5"
          >
            <motion.div variants={ROW} className="flex items-center gap-3 px-3 pt-2 pb-3 mb-1 border-b border-[#1F1F24]">
              <Avatar profile={profile} size={36} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#F4F4F5] truncate">{profile.name}</p>
                <p className="text-[13px] text-[#8B8B94] truncate">{profile.email}</p>
              </div>
            </motion.div>
            <motion.div variants={ROW}>
              <Link role="menuitem" href="/" onClick={() => setOpen(false)} className={ITEM}>
                <Home className="w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
                Home
              </Link>
            </motion.div>
            <motion.div variants={ROW}>
              <Link role="menuitem" href="/history" onClick={() => setOpen(false)} className={ITEM}>
                <Clock className="w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
                History
              </Link>
            </motion.div>
            <motion.div variants={ROW}>
              <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={ITEM}>
                <UserRound className="w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
                Settings
              </Link>
            </motion.div>
            <div className="h-px bg-[#1F1F24] my-1.5" aria-hidden="true" />
            <motion.div variants={ROW}>
              <button type="button" role="menuitem" onClick={signOut} className={ITEM}>
                <LogOut className="w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
                Log out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
