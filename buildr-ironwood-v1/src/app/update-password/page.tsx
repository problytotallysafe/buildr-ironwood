"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { IronwoodLogo } from "@/components/ironwood-logo";
import { createClient } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabaseRef.current = supabase;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const callbackFailed =
      new URLSearchParams(window.location.search).get("status") === "invalid" ||
      hash.has("error");

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      setRecoveryState("ready");
      if (callbackFailed) {
        setMessage("You are already signed in. Choose a new password to finish recovery.");
      }
    });

    async function checkSession() {
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const isRecoveryLink = hash.get("type") === "recovery";

      if (accessToken && refreshToken && isRecoveryLink) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        if (!active) return;
        if (!error && data.user) {
          setRecoveryState("ready");
          return;
        }
      }

      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        setRecoveryState("ready");
        if (callbackFailed) {
          setMessage("You are already signed in. Choose a new password to finish recovery.");
        }
        return;
      }
      setRecoveryState("invalid");
      setMessage(
        callbackFailed
          ? "This password reset link is invalid or expired. Request a fresh link and open the newest email."
          : "Open the latest Buildr password reset email to set a new password.",
      );
    }

    void checkSession();
    return () => {
      active = false;
      supabaseRef.current = null;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (recoveryState !== "ready") {
      setMessage("Open the latest Buildr password reset email before setting a password.");
      return;
    }
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    const supabase = supabaseRef.current;
    if (!supabase) {
      setMessage("The reset session is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <IronwoodLogo />
        <h1>Set your Buildr password</h1>
        {recoveryState === "checking" ? (
          <p className="form-message">Verifying your reset link…</p>
        ) : recoveryState === "invalid" ? (
          <div className="stack">
            <p className="form-message">{message}</p>
            <a className="button button--gold" href="/login">Request a new reset link</a>
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            <label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm password<input type="password" minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <button className="button button--gold" disabled={busy}><KeyRound size={17} />{busy ? "Saving…" : "Save password"}</button>
            {message && <p className="form-message">{message}</p>}
          </form>
        )}
      </section>
      <aside className="login-art"><div><span>Built on quality.</span><h2>Rooted in trust.</h2></div></aside>
    </main>
  );
}
