import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { canManageSettings, getBusinessAccess } from "@/lib/business-access";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim() || null;
}

function boundedNumber(value: FormDataEntryValue | null, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

async function saveSettings(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");
  if (!canManageSettings(access)) redirect("/settings?error=permission");

  const { error } = await supabase.from("business_settings").upsert({
    owner_id: access.ownerId,
    business_name: textValue(formData, "business_name") || "Ironwood Remodeling",
    phone: textValue(formData, "phone"),
    email: textValue(formData, "email"),
    website: textValue(formData, "website"),
    address: textValue(formData, "address"),
    license_number: textValue(formData, "license_number"),
    default_tax_rate: boundedNumber(formData.get("default_tax_rate"), 0, 100, 0),
    default_markup_rate: boundedNumber(formData.get("default_markup_rate"), 0, 1000, 20),
    proposal_terms: textValue(formData, "proposal_terms"),
  }, { onConflict: "owner_id" });

  if (error) redirect("/settings?error=save");
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");

  const { data: settings, error } = await supabase
    .from("business_settings")
    .select("business_name,phone,email,website,address,license_number,default_tax_rate,default_markup_rate,proposal_terms")
    .eq("owner_id", access.ownerId)
    .maybeSingle();
  const editable = canManageSettings(access);

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader eyebrow="Business defaults" title="Business settings" />
      {query.saved === "1" && <p className="success-box">Business settings saved.</p>}
      {(query.error || error) && <p className="error-box">{query.error === "permission" ? "This access level cannot change business settings." : "Business settings could not be loaded or saved. Try again."}</p>}
      <form action={saveSettings} className="panel form-grid">
        <label className="span-2">Business name<input name="business_name" disabled={!editable} defaultValue={settings?.business_name || "Ironwood Remodeling"} /></label>
        <label>Phone<input name="phone" type="tel" disabled={!editable} defaultValue={settings?.phone || ""} /></label>
        <label>Email<input name="email" type="email" disabled={!editable} defaultValue={settings?.email || ""} /></label>
        <label className="span-2">Website<input name="website" disabled={!editable} defaultValue={settings?.website || ""} /></label>
        <label className="span-2">Business address<input name="address" disabled={!editable} defaultValue={settings?.address || ""} /></label>
        <label>License number<input name="license_number" disabled={!editable} defaultValue={settings?.license_number || ""} /></label>
        <label>Default markup %<input name="default_markup_rate" type="number" min="0" max="1000" step="0.1" disabled={!editable} defaultValue={settings?.default_markup_rate ?? 20} /></label>
        <label>Default sales tax %<input name="default_tax_rate" type="number" min="0" max="100" step="0.001" disabled={!editable} defaultValue={settings?.default_tax_rate ?? 0} /></label>
        <label className="span-2">Default proposal terms<textarea name="proposal_terms" rows={8} disabled={!editable} defaultValue={settings?.proposal_terms || "Pricing is based on the scope shown and is valid for 30 days. Changes, concealed conditions, and work outside this scope require written approval and may affect price and schedule."} /></label>
        {editable && <div className="form-actions span-2"><button className="button button--gold">Save business settings</button></div>}
      </form>
    </div>
  );
}
