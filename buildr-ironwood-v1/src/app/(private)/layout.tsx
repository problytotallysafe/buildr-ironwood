import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: activeTime },
    { count: newLeadCount },
    { count: unreadNotificationCount },
    { data: gpsProjects },
  ] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,projects(name,estimates(title))")
      .eq("owner_id", user.id)
      .is("team_member_id", null)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
    supabase
      .from("projects")
      .select("id,name,project_address,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title)")
      .eq("gps_clock_in_enabled", true)
      .in("status", ["scheduled", "in_progress", "waiting"]),
  ]);

  return (
    <AppShell
      email={user.email}
      userId={user.id}
      activeTime={(activeTime ?? null) as any}
      newLeadCount={newLeadCount ?? 0}
      unreadNotificationCount={unreadNotificationCount ?? 0}
      gpsProjects={(gpsProjects ?? []) as any}
    >
      {children}
    </AppShell>
  );
}
