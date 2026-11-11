import { AppNav } from "@/components/app/AppNav";
import { PageTransition } from "@/components/app/PageTransition";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { ProfileInfo } from "@/lib/auth/profile";

/** Settings: the profile and business details, then sign-in, log out and deleting the account. */
export function SettingsView({ profile, pendingEmail }: { profile: ProfileInfo; pendingEmail?: string }) {
  return (
    <PageTransition>
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="profile" />
      <main className="ll-page mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
        <header className="mb-8">
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em]">Settings</h1>
          <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC]">Your profile, how you log in, and your account.</p>
        </header>
        <ProfileForm profile={profile} />
        <AccountSettings
          email={profile.email}
          pendingEmail={pendingEmail}
          usesPassword={profile.usesPassword}
          usesGoogle={profile.usesGoogle}
        />
      </main>
    </div>
    </PageTransition>
  );
}
