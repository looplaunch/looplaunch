import { AppNav } from "@/components/app/AppNav";
import { PageTransition } from "@/components/app/PageTransition";
import { NewAnalysis } from "@/components/onboarding/NewAnalysis";
import { getTokenUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";

/** `?website=` comes from the dashboard's website field and wins over the profile's site. */
export default async function NewAnalysisPage({ searchParams }: { searchParams: Promise<{ website?: string }> }) {
  const { website } = await searchParams;
  const user = await getTokenUser();
  const profile = user ? profileOf(user) : null;
  const fromLink = typeof website === "string" && /^https?:\/\/[^\s]+\.[^\s]+$/i.test(website) ? website : undefined;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#09090B]">
        <AppNav profile={profile} active="new" />
        <div className="ll-page">
          <NewAnalysis defaultWebsite={fromLink || profile?.companyWebsite || undefined} />
        </div>
      </div>
    </PageTransition>
  );
}
