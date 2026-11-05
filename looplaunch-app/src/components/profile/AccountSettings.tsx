"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SettingsSection } from "@/components/profile/SettingsSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DANGER_INLINE,
  FIELD,
  LABEL,
  PRIMARY_INLINE as PRIMARY,
  SECONDARY_INLINE as SECONDARY,
  TEXT_LINK as LINK,
} from "@/components/ui/fields";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { toast } from "@/lib/toast";

const INPUT = `${FIELD} pr-3.5`;
const HINT = "text-[13px] leading-relaxed text-[#8B8B94]";

type Note = { ok: boolean; text: string } | null;

interface AccountSettingsProps {
  email: string;
  /** An email change that's waiting to be confirmed */
  pendingEmail?: string;
  usesPassword: boolean;
  usesGoogle: boolean;
}

function Message({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p key={note.text} className={`ll-swap text-[13px] leading-relaxed ${note.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>
      {note.text}
    </p>
  );
}

function Row({ label, value, action, children }: { label: string; value: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#F4F4F5]">{label}</p>
          <div className="mt-1 text-[14px] leading-6 text-[#B4B4BC] break-words">{value}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Settings → how you sign in (email, password, Google), logging out, and deleting the account. */
export function AccountSettings({ email, pendingEmail, usesPassword, usesGoogle }: AccountSettingsProps) {
  const router = useRouter();

  return (
    <>
      <SettingsSection id="settings-signin" title="Sign-in and security" description="The email you log in with, your password, and Google.">
        <div className="divide-y divide-[#1F1F24]">
          <EmailRow email={email} pendingEmail={pendingEmail} onChanged={() => router.refresh()} />
          <PasswordRow email={email} usesPassword={usesPassword} onChanged={() => router.refresh()} />
          <Row
            label="Google"
            value={
              usesGoogle
                ? "Connected. You can log in with Continue with Google."
                : "Not used yet. Continue with Google also works if your Google account uses this email."
            }
          />
        </div>
      </SettingsSection>

      <SignOutSection />
      <DeleteAccountSection />
    </>
  );
}

// ─── Email ───

type EmailStage = "closed" | "enter" | "new-code" | "current-code";

function EmailRow({ email, pendingEmail, onChanged }: { email: string; pendingEmail?: string; onChanged: () => void }) {
  const [stage, setStage] = useState<EmailStage>("closed");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const reset = (next: EmailStage) => {
    setStage(next);
    setCode("");
    setNote(null);
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = newEmail.trim().toLowerCase();
    if (target === email.toLowerCase()) {
      setNote({ ok: false, text: "That's already your email." });
      return;
    }
    setBusy(true);
    setNote(null);
    // Supabase emails a code (or a link) to the new address, and also to the current one when
    // "secure email change" is on. The change only happens once it's confirmed.
    const { error } = await createSupabaseBrowserClient().auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/profile` }
    );
    setBusy(false);
    if (error) {
      const taken = /already (been )?registered|already exists/i.test(error.message);
      setNote({
        ok: false,
        text: taken
          ? "That email already has a Loop Launch account."
          : /rate limit|seconds/i.test(error.message)
            ? "Please wait a minute before asking for another code."
            : error.message,
      });
      return;
    }
    setNewEmail(target);
    reset("new-code");
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const address = stage === "new-code" ? newEmail : email;
    const { data, error } = await createSupabaseBrowserClient().auth.verifyOtp({
      email: address,
      token: code.trim(),
      type: "email_change",
    });
    setBusy(false);
    if (error) {
      setNote({ ok: false, text: `That code didn't work. Make sure it's the one sent to ${address}.` });
      return;
    }
    if (!data.session) {
      // Secure email change: the first code is accepted, the other address still has to confirm.
      reset(stage === "new-code" ? "current-code" : "new-code");
      return;
    }
    reset("closed");
    setNote({ ok: true, text: `Your email is now ${newEmail}.` });
    toast("Email changed", { description: `You now log in with ${newEmail}.` });
    onChanged();
  };

  const codeFor = stage === "new-code" ? newEmail : email;

  return (
    <Row
      label="Email"
      value={
        <>
          {email}
          {pendingEmail && stage === "closed" && (
            <span className="block text-[13px] text-[#FBBF24] mt-1">
              Waiting for you to confirm the change to {pendingEmail}. Check both inboxes.
            </span>
          )}
        </>
      }
      action={
        stage === "closed" && (
          <button type="button" onClick={() => reset("enter")} className={SECONDARY}>
            Change
          </button>
        )
      }
    >
      {stage === "enter" && (
        <form onSubmit={sendCode} className="mt-5 max-w-sm">
          <label htmlFor="acc-new-email" className={LABEL}>
            New email
          </label>
          <input
            id="acc-new-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={INPUT}
          />
          <div className="mt-4 flex items-center gap-4">
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button type="button" onClick={() => reset("closed")} className={LINK}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {(stage === "new-code" || stage === "current-code") && (
        <form onSubmit={confirm} className="mt-5 space-y-4">
          <p className="text-[14px] text-[#D4D4D8] leading-relaxed">
            {stage === "new-code" ? (
              <>Enter the 6-digit code we sent to <span className="font-medium text-[#F4F4F5]">{codeFor}</span>.</>
            ) : (
              <>
                One more step: enter the code we sent to your current email,{" "}
                <span className="font-medium text-[#F4F4F5]">{codeFor}</span>.
              </>
            )}
          </p>
          <div className="max-w-xs">
            <OtpInput key={stage} value={code} onChange={setCode} disabled={busy} autoFocus status={note && !note.ok ? "error" : "idle"} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY}>
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button type="button" onClick={() => sendCode()} disabled={busy} className={LINK}>
              Send new codes
            </button>
            <button type="button" onClick={() => reset("closed")} className={LINK}>
              Cancel
            </button>
          </div>
          <p className={HINT}>Got a link instead of a code? Click it, and your email changes once it&apos;s confirmed.</p>
        </form>
      )}

      {note && <div className="mt-3"><Message note={note} /></div>}
    </Row>
  );
}

// ─── Password ───

function PasswordRow({ email, usesPassword, onChanged }: { email: string; usesPassword: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  // Supabase can be set to require a fresh code before a password change ("secure password change").
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const close = () => {
    setOpen(false);
    setCurrent("");
    setPassword("");
    setNeedsCode(false);
    setCode("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    if (usesPassword && !needsCode) {
      // Check the current password first, so an unattended open laptop can't change it.
      const { error } = await supabase.auth.signInWithPassword({ email, password: current });
      if (error) {
        setBusy(false);
        setNote({ ok: false, text: "Your current password is wrong." });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
      ...(needsCode ? { nonce: code.trim() } : {}),
    });

    if (error && !needsCode && (error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message))) {
      const { error: sendError } = await supabase.auth.reauthenticate();
      setBusy(false);
      if (sendError) {
        setNote({ ok: false, text: sendError.message });
        return;
      }
      setNeedsCode(true);
      setNote({ ok: true, text: `For security, we sent a 6-digit code to ${email}. Enter it to finish.` });
      return;
    }

    setBusy(false);
    if (error) {
      setNote({ ok: false, text: needsCode ? "That code didn't work. Check it and try again." : error.message });
      return;
    }
    close();
    setNote({
      ok: true,
      text: usesPassword ? "Password changed." : `Password set. You can now also log in with ${email} and this password.`,
    });
    toast(usesPassword ? "Password changed" : "Password set", { description: "Use it the next time you log in." });
    onChanged();
  };

  return (
    <Row
      label="Password"
      value={usesPassword ? "Set" : "Not set. You log in with Google."}
      action={
        !open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setNote(null);
            }}
            className={SECONDARY}
          >
            {usesPassword ? "Change" : "Set a password"}
          </button>
        )
      }
    >
      {open && (
        <form onSubmit={save} className="mt-5 space-y-4 max-w-sm">
          {needsCode ? (
            <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus status={note && !note.ok ? "error" : "idle"} />
          ) : (
            <>
              {usesPassword && (
                <div>
                  <label htmlFor="acc-current-pw" className={LABEL}>
                    Current password
                  </label>
                  <PasswordInput
                    id="acc-current-pw"
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={current}
                    onChange={setCurrent}
                  />
                </div>
              )}
              <div>
                <label htmlFor="acc-new-pw" className={LABEL}>
                  New password (6+ characters)
                </label>
                <PasswordInput
                  id="acc-new-pw"
                  required
                  minLength={6}
                  autoFocus={!usesPassword}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || password.length < 6 || (needsCode && code.length !== 6)}
              className={PRIMARY}
            >
              {busy ? "Saving…" : usesPassword ? "Change password" : "Set password"}
            </button>
            <button type="button" onClick={close} className={LINK}>
              Cancel
            </button>
          </div>
          {usesPassword && !needsCode && (
            <p className={HINT}>Forgot your current password? Log out and use &ldquo;Forgot password?&rdquo; on the login page.</p>
          )}
        </form>
      )}

      {note && <div className="mt-3"><Message note={note} /></div>}
    </Row>
  );
}

// ─── Log out ───

function SignOutSection() {
  const router = useRouter();
  const [busy, setBusy] = useState<"here" | "everywhere" | null>(null);

  const signOut = async (scope: "local" | "global") => {
    setBusy(scope === "local" ? "here" : "everywhere");
    await createSupabaseBrowserClient().auth.signOut({ scope });
    router.push("/");
    router.refresh();
  };

  return (
    <SettingsSection id="settings-logout" title="Log out" description="Your analyses stay saved in your account.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => signOut("local")} disabled={busy !== null} className={SECONDARY}>
          {busy === "here" ? "Logging out…" : "Log out"}
        </button>
        <button type="button" onClick={() => signOut("global")} disabled={busy !== null} className={SECONDARY}>
          {busy === "everywhere" ? "Logging out…" : "Log out of all devices"}
        </button>
      </div>
    </SettingsSection>
  );
}

// ─── Delete account ───

function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't delete your account. Please try again.");
      // The account is gone; clear the login this browser still holds.
      await createSupabaseBrowserClient().auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      id="settings-delete"
      title="Delete account"
      danger
      description="Permanently deletes your account, every analysis and chat in it, and your profile. This can't be undone."
    >
      <p className="text-[14px] leading-6 text-[#B4B4BC]">You&apos;ll be asked to type DELETE before anything is removed.</p>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={`${DANGER_INLINE} mt-4`}
      >
        Delete my account
      </button>

      <ConfirmDialog
        open={open}
        title="Delete your account?"
        description="Your account, all your analyses and chats, and your profile will be permanently deleted. You can sign up again later, but none of this can be brought back."
        confirmLabel="Delete account"
        requireText="DELETE"
        busy={busy}
        error={error}
        onConfirm={remove}
        onClose={() => setOpen(false)}
      />
    </SettingsSection>
  );
}
