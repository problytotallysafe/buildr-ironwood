import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { SiteVisitForm } from "@/components/site-visit-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditSiteVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: worksheet }, { data: customers }, { data: projects }, { data: estimates }] = await Promise.all([
    supabase.from("site_visit_worksheets").select("*,customers(first_name,last_name)").eq("id", id).single(),
    supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name"),
    supabase.from("projects").select("id,name,customer_id").order("created_at", { ascending: false }),
    supabase.from("estimates").select("id,estimate_number,title,customer_id").order("created_at", { ascending: false }),
  ]);
  if (!worksheet) notFound();
  async function save(formData: FormData) {
    "use server";
    const client = await createClient();
    const values = Object.fromEntries(["customer_id","visit_date","project_type","people_present","client_goals","measurements","existing_conditions","plumbing_notes","electrical_notes","hvac_notes","access_protection","selections_discussed","unanswered_questions","follow_up_items","photo_notes","status"].map((key) => [key, String(formData.get(key) || "").trim() || null]));
    await client.from("site_visit_worksheets").update({ ...values, project_id: String(formData.get("project_id") || "") || null, estimate_id: String(formData.get("estimate_id") || "") || null }).eq("id", id);
    revalidatePath("/site-visits");
    revalidatePath(`/site-visits/${id}/edit`);
    redirect("/site-visits");
  }
  return <div className="page-wrap"><PageHeader eyebrow={new Date(`${worksheet.visit_date}T12:00:00`).toLocaleDateString()} title={`${worksheet.customers?.first_name ?? ""} ${worksheet.customers?.last_name ?? ""} site visit`} description="Correct measurements, add what you learned afterward, and mark it complete only when the estimate has what it needs."/><SiteVisitForm action={save} customers={customers ?? []} projects={projects ?? []} estimates={estimates ?? []} worksheet={worksheet}/></div>;
}
