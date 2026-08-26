"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; first_name: string; last_name: string; company_name?: string | null };

export function CustomerSelect({ customers, defaultValue = "", required = true }: { customers: Customer[]; defaultValue?: string; required?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ first_name: "", last_name: "", email: "", phone: "" });

  async function addCustomer() {
    setBusy(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session expired. Sign in again."); setBusy(false); return; }
    const firstName = draft.first_name.trim();
    const lastName = draft.last_name.trim();
    if (!firstName || !lastName) { setError("First and last name are required."); setBusy(false); return; }
    const { data, error: insertError } = await supabase.from("customers").insert({ owner_id: user.id, first_name: firstName, last_name: lastName, email: draft.email.trim() || null, phone: draft.phone.trim() || null }).select("id").single();
    if (insertError || !data) { setError(insertError?.message || "Could not add customer."); setBusy(false); return; }
    setValue(data.id); setAdding(false); setBusy(false); router.refresh();
  }

  return <div className="stack customer-picker">
    <select name="customer_id" required={required} value={value} onChange={(event) => setValue(event.target.value)}>
      <option value="">Choose customer…</option>
      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name}{customer.company_name ? ` — ${customer.company_name}` : ""}</option>)}
    </select>
    <button className="inline-add" type="button" onClick={() => setAdding(!adding)}>{adding ? <X size={15}/> : <Plus size={15}/>} {adding ? "Close" : "Add a new customer"}</button>
    {adding && <div className="quick-customer form-grid">
      <label>First name<input value={draft.first_name} onChange={(e) => setDraft({...draft, first_name:e.target.value})}/></label><label>Last name<input value={draft.last_name} onChange={(e) => setDraft({...draft, last_name:e.target.value})}/></label>
      <label>Email<input value={draft.email} onChange={(e) => setDraft({...draft, email:e.target.value})} type="email"/></label><label>Phone<input value={draft.phone} onChange={(e) => setDraft({...draft, phone:e.target.value})} type="tel"/></label>
      <div className="span-2"><button className="button button--gold" type="button" onClick={addCustomer} disabled={busy}>{busy ? "Adding…" : "Add and select customer"}</button></div>
      {error && <p className="error-box span-2">{error}</p>}
    </div>}
  </div>;
}
