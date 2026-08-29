import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { resolveBusinessAccess } from "@/lib/business-access";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/projects";
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
    { data: gpsProjects },
    { data: settings },
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
    ownerSession ? supabase
      .from("projects")
      .select("id,name,project_address,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title)")
      .eq("gps_clock_in_enabled", true)
      .in("status", [...ACTIVE_PROJECT_STATUSES])
      .order("created_at", { ascending: false }) : Promise.resolve({ data: [] } as any),
    supabase
      .from("business_settings")
      .select("owner_hourly_cost")
      .eq("owner_id", access.ownerId)
      .maybeSingle(),
  ]);

  return (
    <AppShell
      email={user.email}
      businessOwnerId={access.ownerId}
      ownerHourlyCost={Number(settings?.owner_hourly_cost ?? 0)}
      activeTime={(activeTime ?? null) as any}
      newLeadCount={newLeadCount ?? 0}
      unreadNotificationCount={unreadNotificationCount ?? 0}
      gpsProjects={(gpsProjects ?? []) as any}
    >
      {children}
    </AppShell>
  );
}
