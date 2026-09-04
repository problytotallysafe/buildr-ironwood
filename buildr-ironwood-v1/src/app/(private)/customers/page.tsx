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
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const query = await searchParams;
  const search = String(query.q || "").trim().toLowerCase();
  const supabase = await createClient();
  let customerQuery = supabase.from("customers").select("*").order("last_name");
  if (query.view === "deleted") customerQuery = customerQuery.not("deleted_at", "is", null);
  else customerQuery = customerQuery.is("deleted_at", null);
  const { data } = await customerQuery;
  const customers = (data ?? []).filter((customer) => {
    if (!search) return true;
    return [customer.first_name, customer.last_name, customer.company_name, customer.email, customer.phone, customer.city]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Customer database" title={query.view === "deleted" ? "Deleted customers" : "Customers"} actions={<Link href="/customers/new" className="button button--gold">+ Add customer</Link>} />
      <form className="list-filter-bar panel" method="get">
        {query.view && <input type="hidden" name="view" value={query.view} />}
        <label>Search customers<input name="q" defaultValue={query.q || ""} placeholder="Name, company, phone, or email" /></label>
        <div className="button-row">
          <small>{customers.length} shown</small>
          <button className="button button--outline">Search</button>
          {search && <Link className="button button--outline" href={query.view === "deleted" ? "/customers?view=deleted" : "/customers"}>Clear</Link>}
          <Link className="button button--outline" href={query.view === "deleted" ? "/customers" : "/customers?view=deleted"}>{query.view === "deleted" ? "Active customers" : "Deleted customers"}</Link>
        </div>
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
              {!customers.length && <tr><td colSpan={4} className="empty-cell">{search ? "No customers match that search." : query.view === "deleted" ? "No deleted customers." : "No customers yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
