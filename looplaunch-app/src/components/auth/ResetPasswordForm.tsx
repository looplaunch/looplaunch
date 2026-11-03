"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LABEL, PRIMARY } from "@/components/ui/fields";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

/** Set a new password after following a reset link. */
export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const passwordId = useId();
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
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor={passwordId} className={LABEL}>
            New password
          </label>
          <PasswordInput
            id={passwordId}
            required
            minLength={6}
            autoFocus
            autoComplete="new-password"
            placeholder="6 characters or more"
            value={password}
            onChange={setPassword}
          />
        </div>
        <button type="submit" disabled={busy || password.length < 6} className={PRIMARY}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-[13px] text-[#F87171] leading-relaxed">
          {error}
        </p>
      )}
    </AuthShell>
  );
}
