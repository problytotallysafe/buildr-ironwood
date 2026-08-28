import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("last_name");
  return <div className="page-wrap"><PageHeader eyebrow="Customer database" title="Customers" actions={<Link href="/customers/new" className="button button--gold">+ Add customer</Link>} />
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Location</th><th>Added</th></tr></thead><tbody>
      {(data ?? []).map((c: any) => <tr key={c.id}><td><Link className="table-link" href={`/customers/${c.id}`}>{c.first_name} {c.last_name}<small>{c.company_name}</small></Link></td><td>{c.phone || "—"}<small>{c.email}</small></td><td>{[c.city,c.state].filter(Boolean).join(", ") || "—"}</td><td>{new Date(c.created_at).toLocaleDateString()}</td></tr>)}
      {!data?.length && <tr><td colSpan={4} className="empty-cell">No customers yet.</td></tr>}
    </tbody></table></div></section></div>;
}
