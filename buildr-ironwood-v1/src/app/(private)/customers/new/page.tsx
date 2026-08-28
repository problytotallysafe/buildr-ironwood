import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

async function createCustomer(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const value = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const { data, error } = await supabase.from("customers").insert({
    owner_id: user.id, first_name: value("first_name"), last_name: value("last_name"), company_name: value("company_name"),
    email: value("email"), phone: value("phone"), address_line1: value("address_line1"), address_line2: value("address_line2"),
    city: value("city"), state: value("state") || "AR", postal_code: value("postal_code"), notes: value("notes"),
  }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/customers/${data.id}`);
}

export default function NewCustomerPage() {
  return <div className="page-wrap page-wrap--narrow"><PageHeader eyebrow="New record" title="Add customer" />
  <form action={createCustomer} className="panel form-grid">
    <label>First name<input name="first_name" required /></label><label>Last name<input name="last_name" required /></label>
    <label className="span-2">Company name<input name="company_name" /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" /></label>
    <label className="span-2">Street address<input name="address_line1" /></label><label className="span-2">Address line 2<input name="address_line2" /></label>
    <label>City<input name="city" /></label><label>State<input name="state" defaultValue="AR" /></label><label>ZIP code<input name="postal_code" /></label>
    <label className="span-2">Private notes<textarea name="notes" rows={5} /></label>
    <div className="form-actions span-2"><button className="button button--gold">Save customer</button></div>
  </form></div>;
}
