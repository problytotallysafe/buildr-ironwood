import { PageHeader } from "@/components/page-header";
import { TimeTracker } from "@/components/time-tracker";
import { GpsClockInSettings } from "@/components/gps-clock-in";
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

  const [
    { data: projects },
    { data: teamMembers },
    { data: entries },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id,name,status,project_address,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title,estimate_number),customers(first_name,last_name)",
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("team_members")
      .select(
        "id,name,role,hourly_cost,active",
      )
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
      .order("started_at", {
        ascending: false,
      })
      .limit(100),
  ]);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Job costing"
        title="Time Tracker"
      />

      <GpsClockInSettings projects={(projects ?? []) as any} />

      <TimeTracker
        projects={(projects ?? []) as any}
        teamMembers={(teamMembers ?? []) as any}
        entries={(entries ?? []) as any}
        selectedProject={
          query.project ?? ""
        }
      />
    </div>
  );
}
