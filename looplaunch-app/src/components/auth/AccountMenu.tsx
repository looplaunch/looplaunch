"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  "w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#D4D4D8] hover:text-[#F4F4F5] hover:bg-[#1A1A1F] transition-colors cursor-pointer";

/** Avatar with a menu (profile, history, sign out) when signed in; a "Log in" link when not. */
export function AccountMenu({ initialProfile, loginNext }: AccountMenuProps) {
  const user = useAuthUser();
  const router = useRouter();
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

  if (profile === undefined) return <span className="w-8 h-8 rounded-full bg-[#17171B]" aria-hidden="true" />;

  if (!profile) {
    return (
      <Link
        href={loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : "/login"}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#D4D4D8] hover:text-[#F4F4F5] hover:bg-[#17171B] transition-colors"
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
        className="flex rounded-full ring-2 ring-transparent hover:ring-[#3F3F46] focus-visible:ring-[#8B5CF6] transition cursor-pointer"
      >
        <Avatar profile={profile} size={32} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 z-50 rounded-xl bg-[#111114] border border-[#27272A] shadow-2xl shadow-black/60 py-1.5"
        >
          <div className="flex items-center gap-3 px-3.5 pt-2 pb-3 mb-1 border-b border-[#27272A]">
            <Avatar profile={profile} size={36} />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-[#F4F4F5] truncate">{profile.name}</p>
              <p className="text-[12px] text-[#71717A] truncate">{profile.email}</p>
            </div>
          </div>
          <Link role="menuitem" href="/" onClick={() => setOpen(false)} className={ITEM}>
            <Home className="w-4 h-4 text-[#71717A]" />
            Home
          </Link>
          <Link role="menuitem" href="/history" onClick={() => setOpen(false)} className={ITEM}>
            <Clock className="w-4 h-4 text-[#71717A]" />
            History
          </Link>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className={ITEM}>
            <UserRound className="w-4 h-4 text-[#71717A]" />
            Settings
          </Link>
          <div className="h-px bg-[#27272A] my-1.5" />
          <button type="button" role="menuitem" onClick={signOut} className={ITEM}>
            <LogOut className="w-4 h-4 text-[#71717A]" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
