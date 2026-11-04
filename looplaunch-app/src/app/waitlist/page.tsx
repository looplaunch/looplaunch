import type { Metadata } from "next";
import { WaitlistLandingPage } from "@/components/landing/LandingPage";
import { getTokenUser } from "@/lib/auth/supabase-server";
import { canUseApp } from "@/lib/auth/team";

export const metadata: Metadata = {
  title: "Join the waitlist",
  alternates: { canonical: "/" },
  robots: { index: false },
};

/**
 * The waitlist page at its own address: "/" shows it to visitors, while the
 * team (who get their dashboard there) can open it here.
 */
export default async function WaitlistPage() {
  const user = await getTokenUser();
  return <WaitlistLandingPage signedInEmail={user && !canUseApp(user.email) ? user.email : null} />;
}
