"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IronwoodLogo } from "@/components/ironwood-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage("Email or password is incorrect. Use Set or reset password if this is your first password login.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    setBusy(false);
    setMessage(error ? error.message : "Check your email to set a new password.");
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <IronwoodLogo />
        <h1>Sign in to Buildr</h1>
        <form onSubmit={submit} className="stack">
          <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@ironwood-remodeling.com" /></label>
          <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <button className="button button--gold" disabled={busy}><KeyRound size={17} />{busy ? "Signing in…" : "Sign in"}</button>
          <button className="login-reset-link" type="button" disabled={busy} onClick={resetPassword}>Set or reset password</button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
      <aside className="login-art"><div><span>Built on quality.</span><h2>Rooted in trust.</h2></div></aside>
    </main>
  );
}
