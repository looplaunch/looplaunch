import type { User } from "@supabase/supabase-js";

/**
 * Everything the app shows about the signed-in person, read from Supabase user metadata.
 * Our own fields use their own keys (display_name, avatar_color…), because Google
 * rewrites full_name and avatar_url on every Google sign-in.
 */
export interface ProfileInfo {
  name: string;
  firstName: string;
  email: string;
  initials: string;
  /** Photo to show, or undefined to show initials */
  avatarUrl?: string;
  /** Google photo, if they signed in with Google (shown even when they picked initials, as an option) */
  googlePhotoUrl?: string;
  avatarColor: string;
  jobTitle: string;
  companyName: string;
  companyWebsite: string;
  usesPassword: boolean;
  usesGoogle: boolean;
}

export const AVATAR_COLORS = ["#8B5CF6", "#F472B6", "#60A5FA", "#34D399", "#F59E0B", "#F87171"];

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "Rhythm Sarma" → "RS", "loopy" → "L" */
export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function profileOf(user: Pick<User, "email" | "user_metadata" | "app_metadata">): ProfileInfo {
  const meta = user.user_metadata || {};
  const email = user.email || "";
  const name = str(meta.display_name) || str(meta.full_name) || str(meta.name) || email.split("@")[0] || "You";
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = initialsOf(name);
  const googlePhotoUrl = str(meta.avatar_url) || str(meta.picture) || undefined;
  const providers: string[] = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : user.app_metadata?.provider
      ? [user.app_metadata.provider]
      : [];

  return {
    name,
    firstName: parts[0] || name,
    email,
    initials,
    googlePhotoUrl,
    avatarUrl: meta.avatar_mode === "initials" ? undefined : googlePhotoUrl,
    avatarColor: AVATAR_COLORS.includes(str(meta.avatar_color)) ? str(meta.avatar_color) : AVATAR_COLORS[0],
    jobTitle: str(meta.job_title),
    companyName: str(meta.company_name),
    companyWebsite: str(meta.company_website),
    usesPassword: providers.includes("email"),
    usesGoogle: providers.includes("google"),
  };
}
