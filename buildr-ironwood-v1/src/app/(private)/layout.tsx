import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { resolveBusinessAccess } from "@/lib/business-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const access = await resolveBusinessAccess(supabase, user);
  if (!access) redirect("/auth/signout?reason=no-access");
  const ownerSession = access.role === "owner";

  const [
    { data: activeTime },
    { count: newLeadCount },
    { count: unreadNotificationCount },
  ] = await Promise.all([
    ownerSession ? supabase
      .from("time_entries")
      .select("id,project_id,started_at,projects(name,estimates(title))")
      .eq("owner_id", access.ownerId)
      .is("team_member_id", null)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle() : Promise.resolve({ data: null } as any),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .is("archived_at", null)
      .is("deleted_at", null),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  return (
    <AppShell
      email={user.email}
      businessOwnerId={access.ownerId}
      activeTime={(activeTime ?? null) as any}
      newLeadCount={newLeadCount ?? 0}
      unreadNotificationCount={unreadNotificationCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
