import { createHash, timingSafeEqual } from "node:crypto";

import { isActiveProjectStatus } from "./projects.ts";

export type OwnTracksPayload = Record<string, unknown>;

export type OwnTracksTransition = {
  event: "enter" | "leave";
  occurredAt: string;
  timestamp: number;
  waypointTimestamp: number | null;
  rid: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
};

export type TrackingProject = {
  id: string;
  name: string | null;
  status: string;
  jobsite_latitude: number | null;
  jobsite_longitude: number | null;
  geofence_radius_meters: number | null;
  gps_clock_in_enabled: boolean;
  estimates?: { title: string | null } | null;
};

const buildrRegionPrefix = "buildr-";
const buildrDescriptionPrefix = "Buildr · ";

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function limitedText(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximumLength)
    : null;
}

export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function deviceSecretMatches(expectedHash: string, suppliedSecret: string) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashDeviceSecret(suppliedSecret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseBasicAuthorization(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    const username = decoded.slice(0, separator).trim();
    const password = decoded.slice(separator + 1);
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
}

export function parseOwnTracksTransition(
  payload: OwnTracksPayload,
  now = new Date(),
): OwnTracksTransition | null {
  const event = payload.event;
  if (event !== "enter" && event !== "leave") return null;

  const timestamp = finiteNumber(payload.tst);
  if (timestamp == null) return null;

  const occurredAt = new Date(Math.round(timestamp) * 1000);
  const oldestAllowed = now.getTime() - 45 * 24 * 60 * 60 * 1000;
  const newestAllowed = now.getTime() + 10 * 60 * 1000;
  if (
    Number.isNaN(occurredAt.getTime())
    || occurredAt.getTime() < oldestAllowed
    || occurredAt.getTime() > newestAllowed
  ) {
    return null;
  }

  const latitude = finiteNumber(payload.lat);
  const longitude = finiteNumber(payload.lon);
  const accuracy = finiteNumber(payload.acc);
  const waypointTimestamp = finiteNumber(payload.wtst);

  return {
    event,
    occurredAt: occurredAt.toISOString(),
    timestamp: Math.round(timestamp),
    waypointTimestamp: waypointTimestamp == null ? null : Math.round(waypointTimestamp),
    rid: limitedText(payload.rid, 120),
    description: limitedText(payload.desc, 160),
    latitude: latitude != null && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: longitude != null && Math.abs(longitude) <= 180 ? longitude : null,
    accuracyMeters: accuracy != null && accuracy >= 0 ? accuracy : null,
  };
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6_371_000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isTrackingProject(project: TrackingProject) {
  return project.gps_clock_in_enabled
    && isActiveProjectStatus(project.status)
    && project.jobsite_latitude != null
    && project.jobsite_longitude != null;
}

export function matchTransitionProject(
  projects: TrackingProject[],
  transition: OwnTracksTransition,
) {
  if (transition.rid?.startsWith(buildrRegionPrefix)) {
    const id = transition.rid.slice(buildrRegionPrefix.length);
    const exact = projects.find((project) => project.id === id);
    return exact && isTrackingProject(exact) ? exact : null;
  }

  if (transition.waypointTimestamp != null) {
    const exact = projects.find(
      (project) => ownTracksWaypointTimestamp(project.id) === transition.waypointTimestamp,
    );
    if (exact) return isTrackingProject(exact) ? exact : null;
    if (transition.description?.startsWith(buildrDescriptionPrefix)) return null;
  }

  if (transition.latitude == null || transition.longitude == null) return null;

  return projects
    .filter(isTrackingProject)
    .map((project) => ({
      project,
      distance: distanceMeters(
        transition.latitude!,
        transition.longitude!,
        Number(project.jobsite_latitude),
        Number(project.jobsite_longitude),
      ),
    }))
    .filter(({ project, distance }) => {
      const radius = Math.max(50, Number(project.geofence_radius_meters ?? 150));
      const tolerance = Math.max(50, transition.accuracyMeters ?? 0);
      return distance <= radius + tolerance;
    })
    .sort((a, b) => a.distance - b.distance)[0]?.project ?? null;
}

export function ownTracksEventKey(
  deviceId: string,
  transition: OwnTracksTransition,
) {
  return createHash("sha256")
    .update([
      deviceId,
      transition.rid ?? "unknown",
      transition.event,
      transition.timestamp,
    ].join("|"), "utf8")
    .digest("hex");
}

function projectName(project: TrackingProject) {
  return (project.estimates?.title || project.name || "Buildr job").slice(0, 80);
}

export function ownTracksWaypointTimestamp(projectId: string) {
  const value = createHash("sha256").update(projectId, "utf8").digest().readUInt32BE(0);
  return value % 2_147_483_647 || 1;
}

export function buildOwnTracksWaypointCommand(projects: TrackingProject[]) {
  const waypoints = projects
    .map((project) => {
      const active = isTrackingProject(project);
      return {
        _type: "waypoint",
        tst: ownTracksWaypointTimestamp(project.id),
        rid: `${buildrRegionPrefix}${project.id}`,
        desc: `${buildrDescriptionPrefix}${projectName(project)}`.slice(0, 100),
        rad: active
          ? Math.min(1000, Math.max(50, Number(project.geofence_radius_meters ?? 150)))
          : 1,
        lat: active ? Number(project.jobsite_latitude) : 0,
        lon: active ? Number(project.jobsite_longitude) : 0,
      };
    });

  if (!waypoints.length) return [];
  return [{
    _type: "cmd",
    action: "setWaypoints",
    waypoints: {
      _type: "waypoints",
      waypoints,
    },
  }];
}
