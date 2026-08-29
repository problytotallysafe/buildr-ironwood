import { NextResponse } from "next/server";

import {
  buildOwnTracksWaypointCommand,
  deviceSecretMatches,
  matchTransitionProject,
  ownTracksEventKey,
  parseBasicAuthorization,
  parseOwnTracksTransition,
  type OwnTracksPayload,
  type TrackingProject,
} from "@/lib/owntracks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumBodyBytes = 64 * 1024;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Buildr Android"',
    },
  });
}

function ownTracksResponse(commands: unknown[]) {
  return NextResponse.json(commands, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function notifyReview(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  title: string,
  body: string,
) {
  await admin.from("notifications").insert({
    owner_id: ownerId,
    title,
    body,
    href: "/settings/time#android-tracking",
    kind: "time",
  });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumBodyBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const credentials = parseBasicAuthorization(request.headers.get("authorization"));
  if (!credentials) return unauthorized();

  const admin = createAdminClient();
  const { data: device, error: deviceError } = await admin
    .from("android_tracking_devices")
    .select("id,owner_id,secret_hash,active")
    .eq("username", credentials.username)
    .maybeSingle();

  if (
    deviceError
    || !device
    || !device.active
    || !deviceSecretMatches(device.secret_hash, credentials.password)
  ) {
    return unauthorized();
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maximumBodyBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: OwnTracksPayload = {};
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }
      payload = parsed as OwnTracksPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  const now = new Date();
  const [
    { data: projectRows, error: projectsError },
    { data: timeSettings },
  ] = await Promise.all([
    admin
      .from("projects")
      .select("id,name,status,jobsite_latitude,jobsite_longitude,geofence_radius_meters,gps_clock_in_enabled,estimates(title)")
      .eq("owner_id", device.owner_id),
    admin
      .from("business_settings")
      .select("owner_hourly_cost,android_minimum_visit_minutes,android_maximum_visit_hours")
      .eq("owner_id", device.owner_id)
      .maybeSingle(),
  ]);

  if (projectsError) {
    return NextResponse.json({ error: "Could not load Buildr jobs" }, { status: 500 });
  }

  const projects = (projectRows ?? []) as unknown as TrackingProject[];
  const minimumVisitMinutes = Math.min(120, Math.max(1, Number(timeSettings?.android_minimum_visit_minutes ?? 5)));
  const maximumVisitMinutes = Math.min(24, Math.max(1, Number(timeSettings?.android_maximum_visit_hours ?? 18))) * 60;
  const ownerHourlyCost = Math.min(1000, Math.max(0, Number(timeSettings?.owner_hourly_cost ?? 0)));
  const commands = buildOwnTracksWaypointCommand(projects);

  await admin
    .from("android_tracking_devices")
    .update({ last_seen_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", device.id);

  const transition = parseOwnTracksTransition(payload, now);
  if (!transition) return ownTracksResponse(commands);

  const project = matchTransitionProject(projects, transition);
  const externalKey = ownTracksEventKey(device.id, transition);
  const { data: trackingEvent, error: eventError } = await admin
    .from("android_tracking_events")
    .insert({
      owner_id: device.owner_id,
      device_id: device.id,
      project_id: project?.id ?? null,
      event_type: transition.event,
      occurred_at: transition.occurredAt,
      external_key: externalKey,
      status: project ? "pending" : "unmatched",
    })
    .select("id")
    .single();

  if (eventError?.code === "23505") return ownTracksResponse(commands);
  if (eventError || !trackingEvent) {
    return NextResponse.json({ error: "Could not record location event" }, { status: 500 });
  }

  if (!project) {
    await notifyReview(
      admin,
      device.owner_id,
      "Android visit needs review",
      "OwnTracks reported a jobsite transition that did not match an enabled active Buildr project.",
    );
    return ownTracksResponse(commands);
  }

  if (transition.event === "enter") return ownTracksResponse(commands);

  const { data: arrival } = await admin
    .from("android_tracking_events")
    .select("id,occurred_at")
    .eq("device_id", device.id)
    .eq("project_id", project.id)
    .eq("event_type", "enter")
    .eq("status", "pending")
    .lte("occurred_at", transition.occurredAt)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!arrival) {
    await admin.from("android_tracking_events")
      .update({ status: "unmatched" })
      .eq("id", trackingEvent.id);
    await notifyReview(
      admin,
      device.owner_id,
      "Android departure needs review",
      `${project.estimates?.title || project.name || "A Buildr job"} reported a departure without a matching arrival.`,
    );
    return ownTracksResponse(commands);
  }

  const { data: claimedArrival } = await admin
    .from("android_tracking_events")
    .update({ status: "processing", paired_event_id: trackingEvent.id })
    .eq("id", arrival.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimedArrival) {
    await admin.from("android_tracking_events")
      .update({ status: "unmatched" })
      .eq("id", trackingEvent.id);
    return ownTracksResponse(commands);
  }

  const startedAt = new Date(arrival.occurred_at);
  const endedAt = new Date(transition.occurredAt);
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));

  if (durationMinutes < minimumVisitMinutes || durationMinutes > maximumVisitMinutes) {
    await Promise.all([
      admin.from("android_tracking_events").update({ status: "review_duration", paired_event_id: trackingEvent.id }).eq("id", arrival.id),
      admin.from("android_tracking_events").update({ status: "review_duration", paired_event_id: arrival.id }).eq("id", trackingEvent.id),
    ]);
    await notifyReview(
      admin,
      device.owner_id,
      "Android visit duration needs review",
      `${project.estimates?.title || project.name || "A Buildr job"} reported ${durationMinutes} minutes on site, so Buildr did not create an automatic entry.`,
    );
    return ownTracksResponse(commands);
  }

  const { data: overlaps } = await admin
    .from("time_entries")
    .select("id")
    .eq("owner_id", device.owner_id)
    .lt("started_at", endedAt.toISOString())
    .or(`ended_at.is.null,ended_at.gt.${startedAt.toISOString()}`)
    .limit(1);

  if (overlaps?.length) {
    await Promise.all([
      admin.from("android_tracking_events").update({ status: "overlap", paired_event_id: trackingEvent.id }).eq("id", arrival.id),
      admin.from("android_tracking_events").update({ status: "overlap", paired_event_id: arrival.id }).eq("id", trackingEvent.id),
    ]);
    await notifyReview(
      admin,
      device.owner_id,
      "Android visit overlaps existing time",
      `${project.estimates?.title || project.name || "A Buildr job"} matched an existing time entry, so Buildr avoided a duplicate.`,
    );
    return ownTracksResponse(commands);
  }

  const sourceKey = `owntracks:${device.id}:${arrival.id}:${trackingEvent.id}`;
  const { data: timeEntry, error: timeError } = await admin
    .from("time_entries")
    .insert({
      owner_id: device.owner_id,
      project_id: project.id,
      team_member_id: null,
      worker_name: "Owner",
      work_category: "General",
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      notes: "Android geofence · OwnTracks arrival/departure",
      mileage: 0,
      billable: true,
      manual_entry: false,
      hourly_cost: ownerHourlyCost,
      clock_in_method: "android_geofence",
      external_source_key: sourceKey,
    })
    .select("id")
    .single();

  if (timeError?.code === "23505") {
    const { data: existingTime } = await admin
      .from("time_entries")
      .select("id")
      .eq("owner_id", device.owner_id)
      .eq("external_source_key", sourceKey)
      .maybeSingle();
    if (existingTime) {
      await Promise.all([
        admin.from("android_tracking_events").update({ status: "paired", paired_event_id: trackingEvent.id, time_entry_id: existingTime.id }).eq("id", arrival.id),
        admin.from("android_tracking_events").update({ status: "paired", paired_event_id: arrival.id, time_entry_id: existingTime.id }).eq("id", trackingEvent.id),
      ]);
      return ownTracksResponse(commands);
    }
  }
  if (timeError || !timeEntry) {
    await Promise.all([
      admin.from("android_tracking_events").update({ status: "error" }).eq("id", arrival.id),
      admin.from("android_tracking_events").update({ status: "error", paired_event_id: arrival.id }).eq("id", trackingEvent.id),
    ]);
    await notifyReview(
      admin,
      device.owner_id,
      "Android time entry could not be saved",
      `${project.estimates?.title || project.name || "A Buildr job"} has a paired arrival and departure that needs review.`,
    );
    return NextResponse.json({ error: "Could not create Buildr time entry" }, { status: 500 });
  }

  await Promise.all([
    admin.from("android_tracking_events").update({ status: "paired", paired_event_id: trackingEvent.id, time_entry_id: timeEntry.id }).eq("id", arrival.id),
    admin.from("android_tracking_events").update({ status: "paired", paired_event_id: arrival.id, time_entry_id: timeEntry.id }).eq("id", trackingEvent.id),
  ]);

  return ownTracksResponse(commands);
}
