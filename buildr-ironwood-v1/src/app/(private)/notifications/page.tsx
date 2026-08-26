import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  async function markAllRead() { "use server"; const client = await createClient(); const { data: { user } } = await client.auth.getUser(); if (!user) return; await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("owner_id", user.id).is("read_at", null); revalidatePath("/notifications"); }
  return <div className="page-wrap page-wrap--narrow"><PageHeader eyebrow="Buildr alerts" title="Notifications" description="New leads, customer activity, and items that need your attention." actions={<form action={markAllRead}><button className="button button--outline">Mark all read</button></form>}/><section className="panel record-list">{(items ?? []).map((item) => <Link key={item.id} href={item.href || "#"} className={!item.read_at ? "notification--unread" : ""}><div><strong>{item.title}</strong><span>{item.body || ""}</span><small>{new Date(item.created_at).toLocaleString()}</small></div></Link>)}{!items?.length && <p className="empty-cell">You’re all caught up.</p>}</section></div>;
}
