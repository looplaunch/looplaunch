"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FIELD, LABEL, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/ui/fields";
import { OtpInput } from "@/components/auth/OtpInput";
import RubberSegment from "@/components/reactbits/RubberSegment";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { startGoogleSignIn } from "@/lib/auth/google";

type Mode = "signin" | "signup";
/** form: log in / sign up. code: confirm a new account. forgot: ask for a reset link. sent: check your email. */
type Step = "form" | "code" | "forgot" | "sent";

interface LoginFormProps {
  /** Where to go after logging in (same-site path). */
  next: string;
  /** Set when a sign-in (Google) or password reset link came back with an error. */
  failed?: "auth" | "reset";
}

const FAILED_MESSAGES = {
  auth: "Sign-in didn't finish. Please try again.",
  reset: "That reset link didn't work. It may have expired or been opened in another browser. Ask for a new one below.",
};

const WRONG_PASSWORD =
  "Email or password is wrong. Signed up with Google? Use Continue with Google, or tap Forgot password to set a password.";

export function LoginForm({ next, failed }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>(failed === "reset" ? "forgot" : "form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const [error, setError] = useState(failed ? FAILED_MESSAGES[failed] : "");
  const [info, setInfo] = useState("");
  const emailId = useId();
  const passwordId = useId();

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  const goTo = (target: Step) => {
    setStep(target);
    setCode("");
    setError("");
    setInfo("");
  };

  const signInWithGoogle = async () => {
    setError("");
    setBusy(true);
    setOpeningGoogle(true);
    const message = await startGoogleSignIn(next);
    if (message) {
      setError(message);
      setBusy(false);
      setOpeningGoogle(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          // Account exists but the email was never confirmed. Send a fresh code.
          await supabase.auth.resend({ type: "signup", email });
          setStep("code");
          setInfo(`Your email isn't confirmed yet. We sent a 6-digit code to ${email}.`);
        } else {
          // Accounts made with Google have no password, which looks exactly like a wrong one.
          setError(error.message === "Invalid login credentials" ? WRONG_PASSWORD : error.message);
        }
        setBusy(false);
        return;
      }
      finish();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      // Supabase returns an empty identity list when the email already has an account.
      setError("An account with this email already exists. Sign in instead.");
      setMode("signin");
      return;
    }
    setStep("code");
    setInfo(`We sent a 6-digit code to ${email}.`);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    if (error) {
      setBusy(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }
    finish();
  };

  const resendCode = async () => {
    setError("");
    setInfo("");
    const { error } = await createSupabaseBrowserClient().auth.resend({ type: "signup", email });
    setInfo(error ? error.message : "New code sent. Check your inbox and spam folder.");
  };

  // ─── Forgot password ───

  const sendResetLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    // The email's "Reset password" button goes through the callback (which logs them in)
    // to /reset-password, where they pick the new password. Supabase doesn't say whether
    // the email has an account, so neither do we.
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setBusy(false);
    if (error) {
      setError(/rate limit|seconds/i.test(error.message) ? "Please wait a minute before asking for another email." : error.message);
      return;
    }
    setStep("sent");
    if (e === undefined) setInfo("Sent again.");
  };

  const titles: Record<Step, [string, string]> = {
    form: [
      mode === "signin" ? "Welcome back" : "Save your analyses",
      "Log in to keep your analyses and chat with Loopy from any device.",
    ],
    code: ["Check your email", "Enter the 6-digit code we emailed you."],
    forgot: ["Reset your password", "Enter your email and we'll send you a link to reset it."],
    sent: ["Check your email", `If ${email} has an account, we sent it a reset link. Open it in this browser to choose a new password.`],
  };

  return (
    <AuthShell title={titles[step][0]} subtitle={titles[step][1]}>
      <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.55, 0.055, 0.675, 0.19] } }}
      >
      {step === "form" && (
        <>
          <button type="button" onClick={signInWithGoogle} disabled={busy} className={SECONDARY}>
            <GoogleIcon />
            {openingGoogle ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-3 text-[13px] text-[#8B8B94]">
            <span className="h-px flex-1 bg-[#26262C]" aria-hidden="true" />
            or use your email
            <span className="h-px flex-1 bg-[#26262C]" aria-hidden="true" />
          </div>

          <RubberSegment
            items={[
              { value: "signin", label: "Log in" },
              { value: "signup", label: "Create account" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v as Mode);
              setError("");
              setInfo("");
            }}
            aria-label="Log in or create an account"
            size="sm"
            radius={999}
            trackColor="#09090B"
            thumbColor="#2A2A30"
            textColor="#B4B4BC"
            activeTextColor="#F4F4F5"
            className="w-full mb-5"
          />

          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label htmlFor={emailId} className={LABEL}>
                Email
              </label>
              <input
                id={emailId}
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${FIELD} pr-3.5`}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <label htmlFor={passwordId} className="text-[14px] font-medium text-[#D4D4D8]">
                  Password
                </label>
                {mode === "signin" && (
                  <button type="button" onClick={() => goTo("forgot")} className={TEXT_LINK}>
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id={passwordId}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "6 characters or more" : undefined}
                value={password}
                onChange={setPassword}
              />
            </div>
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy && !openingGoogle
                ? mode === "signin"
                  ? "Logging in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus status={error ? "error" : "idle"} />
          <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY}>
            {busy ? "Checking…" : "Verify and continue"}
          </button>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={resendCode} className={TEXT_LINK}>
              Send a new code
            </button>
            <button type="button" onClick={() => goTo("form")} className={TEXT_LINK}>
              Use a different email
            </button>
          </div>
        </form>
      )}

      {step === "forgot" && (
        <form onSubmit={sendResetLink} className="space-y-4">
          <div>
            <label htmlFor={emailId} className={LABEL}>
              Email
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${FIELD} pr-3.5`}
            />
          </div>
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <div className="text-center">
            <button type="button" onClick={() => goTo("form")} className={TEXT_LINK}>
              Back to log in
            </button>
          </div>
        </form>
      )}

      {step === "sent" && (
        <div className="space-y-4">
          <p className="text-[14px] text-[#B4B4BC] leading-relaxed">Didn&apos;t get it? Check your spam folder.</p>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => sendResetLink()} disabled={busy} className={TEXT_LINK}>
              {busy ? "Sending…" : "Send it again"}
            </button>
            <button type="button" onClick={() => goTo("form")} className={TEXT_LINK}>
              Back to log in
            </button>
          </div>
        </div>
      )}

      </motion.div>
      </AnimatePresence>
      </MotionConfig>

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-[#F87171] leading-relaxed">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="mt-4 text-[13px] text-[#B4B4BC] leading-relaxed">
          {info}
        </p>
      )}
    </AuthShell>
  );
}
