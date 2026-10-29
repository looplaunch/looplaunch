import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getCurrentUser } from "@/lib/auth/supabase-server";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

/** Where a password reset link lands (signed in by the link) to pick the new password. */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=reset");
  return <ResetPasswordForm email={user.email ?? ""} />;
}
