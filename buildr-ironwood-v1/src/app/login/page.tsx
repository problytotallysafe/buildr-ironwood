"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IronwoodLogo } from "@/components/ironwood-logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <IronwoodLogo />
        <h1>Your remodeling business, organized.</h1>
        <p>Customers, detailed estimates, proposal approvals, project progress, and payments in one place.</p>
        <form onSubmit={submit} className="stack">
          <label>Email address<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ironwood-remodeling.com" /></label>
          <button className="button button--gold" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
      <aside className="login-art"><div><span>Built on quality.</span><h2>Rooted in trust.</h2><p>Professional tools should reflect the same craftsmanship as the work they support.</p></div></aside>
    </main>
  );
}
