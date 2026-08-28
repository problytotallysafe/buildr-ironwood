import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Archive, ArchiveRestore, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  leadCategories,
  leadPriorities,
  leadStatuses,
  optionLabel,
} from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

type LeadView = "active" | "archived" | "trash" | "all";

function safeView(value?: string): LeadView {
  return ["active", "archived", "trash", "all"].includes(value ?? "")
    ? (value as LeadView)
    : "active";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    status?: string;
    category?: string;
    priority?: string;
    source?: string;
    q?: string;
  }>;
}) {
  const filters = await searchParams;
  const view = safeView(filters.view);
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id,first_name,last_name,email,phone,project_type,status,source,category,priority,created_at,archived_at,deleted_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const allLeads = data ?? [];
  const counts = {
    active: allLeads.filter((lead) => !lead.archived_at && !lead.deleted_at).length,
    archived: allLeads.filter((lead) => lead.archived_at && !lead.deleted_at).length,
    trash: allLeads.filter((lead) => lead.deleted_at).length,
    all: allLeads.filter((lead) => !lead.deleted_at).length,
  };

  const sources = [...new Set(allLeads.map((lead) => lead.source).filter(Boolean))].sort();
  const query = (filters.q ?? "").trim().toLowerCase();

  const leads = allLeads.filter((lead) => {
    const inView =
      view === "trash"
        ? Boolean(lead.deleted_at)
        : view === "archived"
          ? Boolean(lead.archived_at && !lead.deleted_at)
          : view === "all"
            ? !lead.deleted_at
            : !lead.archived_at && !lead.deleted_at;
    if (!inView) return false;
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.category && lead.category !== filters.category) return false;
    if (filters.priority && lead.priority !== filters.priority) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (!query) return true;
    return [lead.first_name, lead.last_name, lead.email, lead.phone, lead.project_type, lead.source]
      .some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  async function organizeLead(formData: FormData) {
    "use server";
    const client = await createClient();
    const id = String(formData.get("id") ?? "");
    const action = String(formData.get("action") ?? "");
    if (!id) return;

    if (action === "archive") {
      await client.from("leads").update({ archived_at: new Date().toISOString(), deleted_at: null }).eq("id", id);
    } else if (action === "delete") {
      await client.from("leads").update({ deleted_at: new Date().toISOString(), archived_at: null }).eq("id", id);
    } else if (action === "restore") {
      await client.from("leads").update({ archived_at: null, deleted_at: null }).eq("id", id);
    }

    if (action !== "restore") {
      await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("href", `/leads/${id}`).is("read_at", null);
    }

    revalidatePath("/leads");
    revalidatePath("/notifications");
  }

  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) currentParams.set(key, value);
  }

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Lead inbox" title="Leads" />

      <nav className="lead-view-tabs panel" aria-label="Lead folders">
        {(["active", "archived", "trash", "all"] as const).map((folder) => {
          const params = new URLSearchParams(currentParams);
          params.set("view", folder);
          return (
            <Link key={folder} href={`/leads?${params.toString()}`} className={view === folder ? "active" : ""}>
              <span>{folder === "trash" ? "Trash" : `${folder[0].toUpperCase()}${folder.slice(1)}`}</span>
              <b>{counts[folder]}</b>
            </Link>
          );
        })}
      </nav>

      <form className="panel lead-filter-grid" method="get">
        <input type="hidden" name="view" value={view} />
        <label className="lead-search-field">
          <span>Search</span>
          <div><Search size={16} /><input name="q" defaultValue={filters.q ?? ""} placeholder="Name, phone, email, or project" /></div>
        </label>
        <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option>{leadStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Category<select name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>{leadCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Priority<select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option>{leadPriorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Source<select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
        <div className="lead-filter-actions"><button className="button button--gold">Apply</button><Link className="button button--outline" href={`/leads?view=${view}`}>Clear</Link></div>
      </form>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Homeowner</th><th>Category</th><th>Project</th><th>Contact</th><th>Status</th><th>Priority</th><th>Received</th><th></th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td><Link className="table-link" href={`/leads/${lead.id}`}>{lead.first_name} {lead.last_name || ""}<small>{lead.source}</small></Link></td>
                  <td>{optionLabel(leadCategories, lead.category)}</td>
                  <td>{lead.project_type || "—"}</td>
                  <td>{lead.phone || lead.email || "—"}</td>
                  <td><StatusPill value={lead.status} /></td>
                  <td><span className={`lead-priority lead-priority--${lead.priority}`}>{optionLabel(leadPriorities, lead.priority)}</span></td>
                  <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td>
                    <form action={organizeLead} className="lead-row-actions">
                      <input type="hidden" name="id" value={lead.id} />
                      {lead.deleted_at || lead.archived_at ? (
                        <button name="action" value="restore" className="icon-button" title="Restore lead" aria-label="Restore lead"><ArchiveRestore size={16} /></button>
                      ) : (
                        <button name="action" value="archive" className="icon-button" title="Archive lead" aria-label="Archive lead"><Archive size={16} /></button>
                      )}
                      {!lead.deleted_at && <button name="action" value="delete" className="icon-button danger" title="Move to trash" aria-label="Move lead to trash"><Trash2 size={16} /></button>}
                    </form>
                  </td>
                </tr>
              ))}
              {!leads.length && <tr><td colSpan={8} className="empty-cell">No leads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
