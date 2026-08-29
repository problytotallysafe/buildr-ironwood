import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getBusinessAccess } from "@/lib/business-access";
import { formatBusinessDateTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

async function markAllRead() {
  "use server";
  const client = await createClient();
  const access = await getBusinessAccess(client);
  if (!access) redirect("/login");
  if (access.role !== "owner" && access.role !== "admin") return;
  await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("owner_id", access.ownerId)
    .is("read_at", null);
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");
  const { data: items } = await supabase
    .from("notifications")
    .select("*")
    .eq("owner_id", access.ownerId)
    .order("created_at", { ascending: false })
    .limit(100);
  const canMarkRead = access.role === "owner" || access.role === "admin";

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader
        eyebrow="Buildr alerts"
        title="Notifications"
        actions={canMarkRead ? <form action={markAllRead}><button className="button button--outline">Mark all read</button></form> : undefined}
      />
      <section className="panel record-list">
        {(items ?? []).map((item) => {
          const content = <div><strong>{item.title}</strong><span>{item.body || ""}</span><small>{formatBusinessDateTime(item.created_at)}</small></div>;
          return item.href
            ? <Link key={item.id} href={item.href} className={!item.read_at ? "notification--unread" : ""}>{content}</Link>
            : <article key={item.id} className={!item.read_at ? "notification--unread notification-static" : "notification-static"}>{content}</article>;
        })}
        {!items?.length && <p className="empty-cell">You’re all caught up.</p>}
      </section>
    </div>
  );
}
