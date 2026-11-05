"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase-browser";
import { hasSupabaseAuthConfig } from "./config";

/**
 * The signed-in user in the browser, for display only (names, avatars, "Log in" links).
 * `undefined` while checking, `null` when signed out. Reads the session the browser already
 * has, so it costs no network call; every permission check happens on the server.
 */
// The last session seen in this tab, so a bar mounted by a page change shows the avatar at once.
// Only ever set in the browser (the callback below), and undefined during hydration, so it can't mismatch.
let lastKnown: User | null | undefined;

export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() => lastKnown);

  useEffect(() => {
    // Without the Supabase settings, login is off: skip the subscription (see the return below).
    if (!hasSupabaseAuthConfig()) return;
    // Fires INITIAL_SESSION right away, then again on sign-in, sign-out and profile updates.
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      lastKnown = session?.user ?? null;
      setUser(lastKnown);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Without the Supabase settings, everyone is shown as signed out instead of crashing.
  return hasSupabaseAuthConfig() ? user : null;
}
