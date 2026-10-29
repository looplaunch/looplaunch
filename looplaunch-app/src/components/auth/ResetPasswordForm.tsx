"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

/** Set a new password after following a reset link. */
export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password, data: { has_password: true } });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <AuthShell title="Choose a new password" subtitle={email ? `For ${email}` : "Pick something you'll remember."}>
      <form onSubmit={save} className="space-y-3">
        <PasswordInput
          required
          minLength={6}
          autoFocus
          autoComplete="new-password"
          placeholder="New password (6+ characters)"
          value={password}
          onChange={setPassword}
        />
        <button
          type="submit"
          disabled={busy || password.length < 6}
          className="w-full rounded-lg bg-[#F4F4F5] text-[#09090B] font-medium text-sm py-2.5 hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      {error && <p className="mt-4 text-xs text-[#F87171] leading-relaxed">{error}</p>}
    </AuthShell>
  );
}
