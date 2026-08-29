import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SiteVisitForm } from "@/components/site-visit-form";
import { SiteVisitPhotos } from "@/components/site-visit-photos";
import { canEditFieldWork, getBusinessAccess } from "@/lib/business-access";
import { createClient } from "@/lib/supabase/server";

export default async function EditSiteVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  const [{ data: worksheet }, { data: customers }, { data: projects }, { data: estimates }, { data: media }] = await Promise.all([
    supabase.from("site_visit_worksheets").select("*,customers(first_name,last_name)").eq("id", id).single(),
    supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name"),
    supabase.from("projects").select("id,name,customer_id").order("created_at", { ascending: false }),
    supabase.from("estimates").select("id,estimate_number,title,customer_id").order("created_at", { ascending: false }),
    supabase.from("site_visit_media").select("id,storage_path,file_name,caption,created_at").eq("worksheet_id", id).order("created_at"),
  ]);
  if (!worksheet) notFound();
  async function save(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canEditFieldWork(currentAccess)) redirect(`/site-visits/${id}/edit`);
    const customerId = String(formData.get("customer_id") || "").trim();
    const next = String(formData.get("_next") || "visits");
    const values = Object.fromEntries(["customer_id","visit_date","project_type","people_present","client_goals","measurements","existing_conditions","plumbing_notes","electrical_notes","hvac_notes","access_protection","selections_discussed","unanswered_questions","follow_up_items","photo_notes","status"].map((key) => [key, String(formData.get(key) || "").trim() || null]));
    const { error } = await client.from("site_visit_worksheets").update({ ...values, project_id: String(formData.get("project_id") || "") || null, estimate_id: String(formData.get("estimate_id") || "") || null }).eq("id", id).eq("owner_id", currentAccess.ownerId);
    if (error) throw new Error(error.message);
    revalidatePath("/site-visits");
    revalidatePath(`/site-visits/${id}/edit`);
    if (next === "estimate") redirect(`/estimates/new?setup=1&customer=${customerId}&projectType=other&siteVisit=${id}`);
    redirect("/site-visits");
  }
  async function organize(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canEditFieldWork(currentAccess)) redirect(`/site-visits/${id}/edit`);
    const action = String(formData.get("action") || "");
    const now = new Date().toISOString();
    let values: { archived_at: string | null; deleted_at: string | null } | null = null;
    if (action === "archive") values = { archived_at: now, deleted_at: null };
    if (action === "delete") values = { archived_at: null, deleted_at: now };
    if (action === "restore") values = { archived_at: null, deleted_at: null };
    if (!values) return;
    const { error } = await client.from("site_visit_worksheets").update(values).eq("id", id).eq("owner_id", currentAccess.ownerId);
    if (error) throw new Error(error.message);
    revalidatePath("/site-visits");
    revalidatePath(`/site-visits/${id}/edit`);
    if (action === "archive") redirect("/site-visits?view=archived");
    if (action === "delete") redirect("/site-visits?view=trash");
    redirect(`/site-visits/${id}/edit`);
  }
  const photos = await Promise.all((media ?? []).map(async (item: any) => ({ ...item, signed_url: (await supabase.storage.from("site-visit-media").createSignedUrl(item.storage_path, 3600)).data?.signedUrl ?? null })));
  const canOrganize = Boolean(access && canEditFieldWork(access));
  const editable = canOrganize && !worksheet.archived_at && !worksheet.deleted_at;
  const actions = canOrganize ? <form action={organize} className="button-row">
    {worksheet.archived_at || worksheet.deleted_at
      ? <button name="action" value="restore" className="button button--outline"><ArchiveRestore size={16}/>Restore</button>
      : <button name="action" value="archive" className="button button--outline"><Archive size={16}/>Archive</button>}
    {!worksheet.deleted_at && <button name="action" value="delete" className="button button--danger"><Trash2 size={16}/>Move to trash</button>}
  </form> : undefined;
  return <div className="page-wrap"><PageHeader eyebrow={new Date(`${worksheet.visit_date}T12:00:00`).toLocaleDateString()} title={`${worksheet.customers?.first_name ?? ""} ${worksheet.customers?.last_name ?? ""} site visit`} actions={actions}/>{worksheet.deleted_at && <div className="settings-warning"><div><strong>This site visit is in Trash.</strong><span>Restore it before making changes or starting an estimate.</span></div></div>}{!worksheet.deleted_at && worksheet.archived_at && <div className="settings-warning"><div><strong>This site visit is archived.</strong><span>Its worksheet and photos are preserved. Restore it whenever the visit becomes active again.</span></div></div>}<SiteVisitForm action={save} customers={customers ?? []} projects={projects ?? []} estimates={estimates ?? []} worksheet={worksheet} editable={editable}/><div style={{marginTop:22}}><SiteVisitPhotos worksheetId={id} photos={photos} editable={editable}/></div></div>;
}
