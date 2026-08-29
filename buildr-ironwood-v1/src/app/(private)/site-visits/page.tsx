import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Archive, ArchiveRestore, ClipboardList, FilePlus2, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { canEditFieldWork, getBusinessAccess } from "@/lib/business-access";
import { createClient } from "@/lib/supabase/server";

type SiteVisitView = "active" | "archived" | "trash" | "all";

function safeView(value?: string): SiteVisitView {
  return ["active", "archived", "trash", "all"].includes(value ?? "")
    ? value as SiteVisitView
    : "active";
}

export default async function SiteVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const query = await searchParams;
  const view = safeView(query.view);
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  const { data } = await supabase
    .from("site_visit_worksheets")
    .select("id,customer_id,estimate_id,visit_date,project_type,status,updated_at,archived_at,deleted_at,customers(first_name,last_name),projects(name),estimates(estimate_number,title)")
    .order("visit_date", { ascending: false });

  const allWorksheets = data ?? [];
  const counts = {
    active: allWorksheets.filter((item) => !item.archived_at && !item.deleted_at).length,
    archived: allWorksheets.filter((item) => item.archived_at && !item.deleted_at).length,
    trash: allWorksheets.filter((item) => item.deleted_at).length,
    all: allWorksheets.filter((item) => !item.deleted_at).length,
  };
  const worksheets = allWorksheets.filter((item) => {
    if (view === "trash") return Boolean(item.deleted_at);
    if (view === "archived") return Boolean(item.archived_at && !item.deleted_at);
    if (view === "all") return !item.deleted_at;
    return !item.archived_at && !item.deleted_at;
  });
  const editable = Boolean(access && canEditFieldWork(access));

  async function organizeSiteVisit(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canEditFieldWork(currentAccess)) return;
    const id = String(formData.get("id") || "");
    const action = String(formData.get("action") || "");
    if (!id) return;
    const now = new Date().toISOString();

    if (action === "archive") {
      await client.from("site_visit_worksheets").update({ archived_at: now, deleted_at: null }).eq("id", id).eq("owner_id", currentAccess.ownerId);
    } else if (action === "delete") {
      await client.from("site_visit_worksheets").update({ deleted_at: now, archived_at: null }).eq("id", id).eq("owner_id", currentAccess.ownerId);
    } else if (action === "restore") {
      await client.from("site_visit_worksheets").update({ archived_at: null, deleted_at: null }).eq("id", id).eq("owner_id", currentAccess.ownerId);
    }

    revalidatePath("/site-visits");
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Before the estimate"
        title="Site visit worksheets"
        actions={editable ? <Link href="/site-visits/new" className="button button--gold"><Plus size={16}/>New site visit</Link> : undefined}
      />

      <nav className="lead-view-tabs panel" aria-label="Site visit folders">
        {(["active", "archived", "trash", "all"] as const).map((folder) => (
          <Link key={folder} href={`/site-visits?view=${folder}`} className={view === folder ? "active" : ""}>
            <span>{folder === "trash" ? "Trash" : `${folder[0].toUpperCase()}${folder.slice(1)}`}</span>
            <b>{counts[folder]}</b>
          </Link>
        ))}
      </nav>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Visit</th><th>Customer / job</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {worksheets.map((worksheet: any) => (
                <tr key={worksheet.id}>
                  <td>{new Date(`${worksheet.visit_date}T12:00:00`).toLocaleDateString()}</td>
                  <td><strong>{worksheet.customers?.first_name} {worksheet.customers?.last_name}</strong><small>{worksheet.projects?.name || worksheet.estimates?.title || "Not linked to a job yet"}</small></td>
                  <td>{worksheet.project_type || "Not entered"}</td>
                  <td><StatusPill value={worksheet.status}/></td>
                  <td>
                    <div className="button-row">
                      <Link className="button button--outline button--small" href={`/site-visits/${worksheet.id}/edit`}><ClipboardList size={15}/>Open worksheet</Link>
                      {!worksheet.archived_at && !worksheet.deleted_at && (worksheet.estimate_id
                        ? <Link className="button button--outline button--small" href={`/estimates/${worksheet.estimate_id}`}><FilePlus2 size={15}/>Open estimate</Link>
                        : worksheet.status === "complete"
                          ? <Link className="button button--outline button--small" href={`/estimates/new?setup=1&customer=${worksheet.customer_id}&projectType=other&siteVisit=${worksheet.id}`}><FilePlus2 size={15}/>Start estimate</Link>
                          : null)}
                      {editable && <form action={organizeSiteVisit} className="lead-row-actions">
                        <input type="hidden" name="id" value={worksheet.id}/>
                        {worksheet.archived_at || worksheet.deleted_at
                          ? <button name="action" value="restore" className="icon-button" title="Restore site visit" aria-label="Restore site visit"><ArchiveRestore size={16}/></button>
                          : <button name="action" value="archive" className="icon-button" title="Archive site visit" aria-label="Archive site visit"><Archive size={16}/></button>}
                        {!worksheet.deleted_at && <button name="action" value="delete" className="icon-button danger" title="Move site visit to trash" aria-label="Move site visit to trash"><Trash2 size={16}/></button>}
                      </form>}
                    </div>
                  </td>
                </tr>
              ))}
              {!worksheets.length && <tr><td colSpan={5} className="empty-cell">No site visits in this folder.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
