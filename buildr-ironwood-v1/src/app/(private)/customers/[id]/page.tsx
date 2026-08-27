import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { StatusPill } from "@/components/status-pill";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient();
  const [{ data: c }, { data: estimates }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("estimates").select("id,estimate_number,title,status,total,created_at").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();
  return <div className="page-wrap"><PageHeader eyebrow="Customer record" title={`${c.first_name} ${c.last_name}`} description={c.company_name || "Ironwood Remodeling customer"} actions={<div className="button-row"><Link className="button button--outline" href={`/customers/${c.id}/edit`}>Edit customer</Link><Link className="button button--outline" href={`/site-visits/new?customer=${c.id}`}>Site visit</Link><Link className="button button--outline" href={`/independence/new?customer=${c.id}`}>Independence review</Link><Link className="button button--gold" href={`/estimates/new?customer=${c.id}`}>+ New estimate</Link></div>} />
  <div className="detail-grid"><section className="panel"><h2>Contact & property</h2><dl className="details"><div><dt>Phone</dt><dd>{c.phone || "—"}</dd></div><div><dt>Email</dt><dd>{c.email || "—"}</dd></div><div><dt>Address</dt><dd>{[c.address_line1,c.address_line2,c.city,c.state,c.postal_code].filter(Boolean).join(", ") || "—"}</dd></div><div><dt>Private notes</dt><dd>{c.notes || "—"}</dd></div></dl></section>
  <section className="panel"><h2>Estimate history</h2><div className="record-list">{(estimates ?? []).map((e:any)=><Link href={`/estimates/${e.id}`} key={e.id}><div><strong>{e.estimate_number}</strong><span>{e.title}</span></div><StatusPill value={e.status}/><b>{money(e.total)}</b></Link>)}{!estimates?.length && <p className="muted">No estimates yet.</p>}</div></section></div></div>;
}
