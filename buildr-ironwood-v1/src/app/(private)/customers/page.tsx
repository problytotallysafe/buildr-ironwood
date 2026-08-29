import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { formatBusinessDate } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

function formatPhone(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : value;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = await searchParams;
  const search = String(query.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("last_name");
  const customers = (data ?? []).filter((customer) => {
    if (!search) return true;
    return [
      customer.first_name,
      customer.last_name,
      customer.company_name,
      customer.email,
      customer.phone,
      customer.city,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Customer database" title="Customers" actions={<Link href="/customers/new" className="button button--gold">+ Add customer</Link>} />
      <form className="list-filter-bar panel" method="get">
        <label>Search customers<input name="q" defaultValue={query.q || ""} placeholder="Name, company, phone, or email" /></label>
        <div className="button-row"><small>{customers.length} of {data?.length ?? 0}</small><button className="button button--outline">Search</button>{search && <Link className="button button--outline" href="/customers">Clear</Link>}</div>
      </form>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Location</th><th>Added</th></tr></thead>
            <tbody>
              {customers.map((customer) => <tr key={customer.id}>
                <td><Link className="table-link" href={`/customers/${customer.id}`}>{customer.first_name} {customer.last_name}<small>{customer.company_name}</small></Link></td>
                <td>{formatPhone(customer.phone)}<small>{customer.email}</small></td>
                <td>{[customer.city, customer.state].filter(Boolean).join(", ") || "—"}</td>
                <td>{formatBusinessDate(customer.created_at)}</td>
              </tr>)}
              {!customers.length && <tr><td colSpan={4} className="empty-cell">{search ? "No customers match that search." : "No customers yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
