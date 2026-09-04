import { CleanTimeTracker } from "@/components/clean-time-tracker";
import { PageHeader } from "@/components/page-header";
import { getBusinessAccess } from "@/lib/business-access";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
  }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);

  const [
    { data: projects },
    { data: teamMembers },
    { data: entries },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,status,project_address,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title,estimate_number),customers(first_name,last_name)")
      .in("status", [...ACTIVE_PROJECT_STATUSES])
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("id,name,role,hourly_cost,active")
      .order("name"),
    supabase
      .from("time_entries")
      .select(`
        id,
        project_id,
        team_member_id,
        worker_name,
        work_category,
        started_at,
        ended_at,
        duration_minutes,
        notes,
        mileage,
        billable,
        manual_entry,
        hourly_cost,
        projects(
          name,
          estimates(title)
        )
      `)
      .order("started_at", { ascending: false })
      .limit(100),
    access
      ? supabase
          .from("business_settings")
          .select("owner_hourly_cost")
          .eq("owner_id", access.ownerId)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const activeProjects = projects ?? [];
  const selectedProject = activeProjects.some((project) => project.id === query.project)
    ? query.project
    : "";

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Job costing" title="Time Tracker" />
      <CleanTimeTracker
        projects={activeProjects as any}
        teamMembers={(teamMembers ?? []) as any}
        entries={(entries ?? []) as any}
        selectedProject={selectedProject}
        ownerHourlyCost={Number(settings?.owner_hourly_cost ?? 0)}
        canTrackOwner={access?.role === "owner"}
        canManageWorkers={access?.role === "owner" || access?.role === "admin"}
      />
    </div>
  );
}
