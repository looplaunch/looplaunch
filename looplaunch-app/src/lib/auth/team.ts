/**
 * Who can use the app. While the waitlist is on (the default), only the team below sees the
 * real app and everyone else sees the waitlist. Set WAITLIST_MODE=off to open the app to
 * everyone; signed-out visitors then get one free strategy before they have to log in.
 *
 * Set TEAM_EMAILS (comma-separated) in the environment to change the team without
 * a code change. Without it, the founders' emails below are used.
 */

const DEFAULT_TEAM_EMAILS = ["work@looplaunch.co", "rhythmsarma66@gmail.com"];

export function teamEmails(): Set<string> {
  const fromEnv = process.env.TEAM_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(fromEnv?.length ? fromEnv : DEFAULT_TEAM_EMAILS);
}

export function isTeamEmail(email: string | null | undefined): boolean {
  return Boolean(email) && teamEmails().has(email!.toLowerCase());
}

/** True unless WAITLIST_MODE=off. */
export function isWaitlistOn(): boolean {
  return process.env.WAITLIST_MODE?.trim().toLowerCase() !== "off";
}

/** May this person use the app? `null` means signed out. Everyone may once the waitlist is off. */
export function canUseApp(email: string | null | undefined): boolean {
  return !isWaitlistOn() || isTeamEmail(email);
}
