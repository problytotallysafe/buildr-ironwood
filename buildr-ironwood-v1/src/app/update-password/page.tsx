"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { IronwoodLogo } from "@/components/ironwood-logo";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
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
        <form onSubmit={submit} className="stack">
          <label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm password<input type="password" minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          <button className="button button--gold" disabled={busy}><KeyRound size={17} />{busy ? "Saving…" : "Save password"}</button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
      <aside className="login-art"><div><span>Built on quality.</span><h2>Rooted in trust.</h2></div></aside>
    </main>
  );
}
