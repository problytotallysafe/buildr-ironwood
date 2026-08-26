import { ArrowRight, CheckCircle2, Minus, Plus } from "lucide-react";
import { money } from "@/lib/money";

type Snapshot = Record<string, any>;
type Revision = {
  id: string;
  revision_number: number;
  reason: string | null;
  prior_status: string;
  prior_accepted_at: string | null;
  prior_accepted_by_name: string | null;
  created_at: string;
  estimate_snapshot: Snapshot;
  items_snapshot: any[];
};

function itemKey(item: any) {
  return [item.category, item.description].map((value) => String(value || "").trim().toLowerCase()).join("::");
}

function compareItems(beforeItems: any[] = [], afterItems: any[] = []) {
  const before = new Map(beforeItems.map((item) => [itemKey(item), item]));
  const after = new Map(afterItems.map((item) => [itemKey(item), item]));
  const added = afterItems.filter((item) => !before.has(itemKey(item)));
  const removed = beforeItems.filter((item) => !after.has(itemKey(item)));
  const changed = afterItems.flatMap((item) => {
    const prior = before.get(itemKey(item));
    if (!prior) return [];
    const differences: string[] = [];
    if (Number(prior.quantity) !== Number(item.quantity)) differences.push(`quantity ${prior.quantity} → ${item.quantity}`);
    if (Number(prior.line_total) !== Number(item.line_total)) differences.push(`${money(prior.line_total)} → ${money(item.line_total)}`);
    if (String(prior.selection_status || "final") !== String(item.selection_status || "final")) differences.push(`${String(prior.selection_status || "final").replaceAll("_", " ")} → ${String(item.selection_status || "final").replaceAll("_", " ")}`);
    return differences.length ? [{ item, differences }] : [];
  });
  return { added, removed, changed };
}

function textChanges(before: Snapshot, after: Snapshot) {
  const fields = [
    ["scope", "Scope of work"],
    ["exclusions", "Exclusions / owner-supplied"],
    ["payment_schedule", "Payment schedule"],
    ["customer_notes", "Customer notes"],
  ] as const;
  return fields.filter(([key]) => String(before?.[key] || "").trim() !== String(after?.[key] || "").trim());
}

export function EstimateRevisionComparison({ currentEstimate, currentItems, revisions }: { currentEstimate: Snapshot; currentItems: any[]; revisions: Revision[] }) {
  if (!revisions.length) return <section className="panel"><h2>Revision comparison</h2><p className="muted">This is the original version. A before-and-after comparison will appear here when it is revised.</p></section>;

  const ordered = [...revisions].sort((a, b) => Number(b.revision_number) - Number(a.revision_number));

  return <section className="panel revision-comparison">
    <div className="panel-heading"><div><h2>What changed?</h2><p>Plain-language comparison of every preserved version.</p></div><strong>{ordered.length} revision{ordered.length === 1 ? "" : "s"}</strong></div>
    <div className="revision-comparison-list">{ordered.map((revision, index) => {
      const before = revision.estimate_snapshot || {};
      const beforeItems = revision.items_snapshot || [];
      const newerRevision = index === 0 ? null : ordered[index - 1];
      const after = newerRevision?.estimate_snapshot || currentEstimate;
      const afterItems = newerRevision?.items_snapshot || currentItems;
      const items = compareItems(beforeItems, afterItems);
      const copyChanges = textChanges(before, after);
      const priceChange = Number(after.total || 0) - Number(before.total || 0);
      const changeCount = items.added.length + items.removed.length + items.changed.length + copyChanges.length + (priceChange !== 0 ? 1 : 0);

      return <details key={revision.id} className="revision-compare-card" open={index === 0}>
        <summary><div><strong>Revision {revision.revision_number}</strong><span>{revision.reason || "No revision reason entered"} · {new Date(revision.created_at).toLocaleString()}</span></div><div className={priceChange > 0 ? "revision-delta revision-delta--up" : priceChange < 0 ? "revision-delta revision-delta--down" : "revision-delta"}>{priceChange === 0 ? "No total change" : `${priceChange > 0 ? "+" : ""}${money(priceChange)}`}<small>{changeCount} change{changeCount === 1 ? "" : "s"}</small></div></summary>
        <div className="revision-before-after"><div><span>Before</span><strong>{money(before.total || 0)}</strong><small>{revision.prior_status}{revision.prior_accepted_at ? ` · Accepted by ${revision.prior_accepted_by_name || "customer"}` : ""}</small></div><ArrowRight/><div><span>After</span><strong>{money(after.total || 0)}</strong><small>{index === 0 ? "Current version" : `Revision ${newerRevision?.revision_number}`}</small></div></div>
        {changeCount === 0 && <p className="revision-no-change"><CheckCircle2 size={17}/>No estimate content or pricing changes detected.</p>}
        {items.added.length > 0 && <div className="revision-change-group"><h3><Plus size={16}/>Added</h3>{items.added.map((item) => <p key={itemKey(item)}><strong>{item.description}</strong><span>{money(item.line_total)}</span></p>)}</div>}
        {items.removed.length > 0 && <div className="revision-change-group"><h3><Minus size={16}/>Removed</h3>{items.removed.map((item) => <p key={itemKey(item)}><strong>{item.description}</strong><span>{money(item.line_total)}</span></p>)}</div>}
        {items.changed.length > 0 && <div className="revision-change-group"><h3>Repriced or adjusted</h3>{items.changed.map(({ item, differences }) => <p key={itemKey(item)}><strong>{item.description}</strong><span>{differences.join(" · ")}</span></p>)}</div>}
        {copyChanges.length > 0 && <div className="revision-change-group"><h3>Proposal wording changed</h3>{copyChanges.map(([key, label]) => <details key={key}><summary>{label}</summary><div className="revision-copy-diff"><div><small>Before</small><p>{before[key] || "Not entered"}</p></div><div><small>After</small><p>{after[key] || "Not entered"}</p></div></div></details>)}</div>}
      </details>;
    })}</div>
  </section>;
}
