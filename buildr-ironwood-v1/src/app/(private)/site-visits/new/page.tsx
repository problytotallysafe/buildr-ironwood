import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SiteVisitForm } from "@/components/site-visit-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewSiteVisitPage({searchParams}:{searchParams:Promise<{customer?:string}>}) {
  const query=await searchParams;
  const supabase = await createClient();
  const [{ data: customers }, { data: projects }, { data: estimates }] = await Promise.all([
    supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name"),
    supabase.from("projects").select("id,name,customer_id").order("created_at", { ascending: false }),
    supabase.from("estimates").select("id,estimate_number,title,customer_id").order("created_at", { ascending: false }),
  ]);
  async function save(formData: FormData) {
    "use server";
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const values = Object.fromEntries(["customer_id","visit_date","project_type","people_present","client_goals","measurements","existing_conditions","plumbing_notes","electrical_notes","hvac_notes","access_protection","selections_discussed","unanswered_questions","follow_up_items","photo_notes","status"].map((key) => [key, String(formData.get(key) || "").trim() || null]));
    const { data } = await client.from("site_visit_worksheets").insert({ owner_id: user.id, ...values, project_id: String(formData.get("project_id") || "") || null, estimate_id: String(formData.get("estimate_id") || "") || null }).select("id").single();
    redirect(data ? `/site-visits/${data.id}/edit` : "/site-visits");
  }
  return <div className="page-wrap"><PageHeader eyebrow="Field worksheet" title="New site visit"/><SiteVisitForm action={save} customers={customers ?? []} projects={projects ?? []} estimates={estimates ?? []} defaultCustomerId={query.customer}/></div>;
}
