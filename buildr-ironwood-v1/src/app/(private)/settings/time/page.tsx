import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AndroidTrackingSetup } from "@/components/android-tracking-setup";
import { GpsClockInSettings } from "@/components/gps-clock-in";
import { PageHeader } from "@/components/page-header";
import { canManageSettings, getBusinessAccess } from "@/lib/business-access";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

function boundedNumber(value: FormDataEntryValue | null, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

async function saveTimeSettings(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");
  if (!canManageSettings(access)) redirect("/settings/time?error=permission");

  const { error } = await supabase.from("business_settings").upsert({
    owner_id: access.ownerId,
    owner_hourly_cost: boundedNumber(formData.get("owner_hourly_cost"), 0, 1000, 0),
    android_minimum_visit_minutes: Math.round(boundedNumber(formData.get("android_minimum_visit_minutes"), 1, 120, 5)),
    android_maximum_visit_hours: Math.round(boundedNumber(formData.get("android_maximum_visit_hours"), 1, 24, 18)),
  }, { onConflict: "owner_id" });

  if (error) redirect("/settings/time?error=save");
  revalidatePath("/settings/time");
  revalidatePath("/time");
  revalidatePath("/analytics");
  revalidatePath("/dashboard");
  redirect("/settings/time?saved=1");
}

export default async function TimeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");

  const [{ data: settings }, { data: projects }] = await Promise.all([
    supabase
      .from("business_settings")
      .select("owner_hourly_cost,android_minimum_visit_minutes,android_maximum_visit_hours")
      .eq("owner_id", access.ownerId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id,name,status,project_address,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title)")
      .in("status", [...ACTIVE_PROJECT_STATUSES])
      .order("created_at", { ascending: false }),
  ]);

  const editable = canManageSettings(access);
  const owner = access.role === "owner";

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader eyebrow="Time automation" title="Time & GPS settings" />
      {query.saved === "1" && <p className="success-box">Time settings saved.</p>}
      {query.error && <p className="error-box">{query.error === "permission" ? "This access level cannot change time settings." : "Time settings could not be saved. Try again."}</p>}

      <form action={saveTimeSettings} className="panel form-grid settings-time-cost">
        <div className="span-2 panel-heading">
          <div><h2>Time costing</h2><p>This rate is an internal business cost. Customers never see it.</p></div>
        </div>
        <label>Owner internal hourly cost
          <input name="owner_hourly_cost" type="number" min="0" max="1000" step="0.01" disabled={!editable} defaultValue={settings?.owner_hourly_cost ?? 0} />
          <small>Used for new owner time and as the fallback for older owner entries saved at $0.</small>
        </label>
        <div className="settings-inline-note"><strong>Owner time stays intact</strong><span>Changing this rate recalculates reports; it does not change the hours recorded.</span></div>

        <div className="span-2 settings-subheading"><h3>Android visit rules</h3><p>Visits outside these limits are sent to Notifications for review instead of being added automatically.</p></div>
        <label>Minimum visit (minutes)<input name="android_minimum_visit_minutes" type="number" min="1" max="120" step="1" disabled={!editable} defaultValue={settings?.android_minimum_visit_minutes ?? 5} /></label>
        <label>Maximum visit (hours)<input name="android_maximum_visit_hours" type="number" min="1" max="24" step="1" disabled={!editable} defaultValue={settings?.android_maximum_visit_hours ?? 18} /></label>
        {editable && <div className="form-actions span-2"><button className="button button--gold">Save time settings</button></div>}
      </form>

      {owner ? (
        <>
          <GpsClockInSettings projects={(projects ?? []) as any} />
          <AndroidTrackingSetup />
        </>
      ) : (
        <section className="panel settings-owner-note"><h2>Phone connections</h2><p>For security, only the primary owner account can connect or disconnect the owner’s phone.</p></section>
      )}
    </div>
  );
}
