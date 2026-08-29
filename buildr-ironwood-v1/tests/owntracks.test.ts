import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOwnTracksWaypointCommand,
  deviceSecretMatches,
  hashDeviceSecret,
  matchTransitionProject,
  ownTracksWaypointTimestamp,
  parseBasicAuthorization,
  parseOwnTracksTransition,
  type TrackingProject,
} from "../src/lib/owntracks.ts";

const project: TrackingProject = {
  id: "4f264d04-b947-4f72-a2e0-966b26a4d3ef",
  name: "Whole Home Remodel",
  status: "in_progress",
  jobsite_latitude: 35.5,
  jobsite_longitude: -94.2,
  geofence_radius_meters: 150,
  gps_clock_in_enabled: true,
  estimates: { title: "2726 Highway 348 Whole Home Remodel" },
};

test("parses and verifies HTTP Basic credentials", () => {
  const header = `Basic ${Buffer.from("device:secret-value").toString("base64")}`;
  assert.deepEqual(parseBasicAuthorization(header), {
    username: "device",
    password: "secret-value",
  });
  assert.equal(deviceSecretMatches(hashDeviceSecret("secret-value"), "secret-value"), true);
  assert.equal(deviceSecretMatches(hashDeviceSecret("secret-value"), "wrong"), false);
});

test("parses an OwnTracks transition and matches the Buildr region id", () => {
  const now = new Date("2026-08-29T15:00:00.000Z");
  const transition = parseOwnTracksTransition({
    _type: "transition",
    event: "enter",
    rid: `buildr-${project.id}`,
    tst: 1788015000,
    lat: 35.5,
    lon: -94.2,
  }, now);
  assert.ok(transition);
  assert.equal(matchTransitionProject([project], transition), project);
});

test("matches the stable Android waypoint timestamp without coordinates", () => {
  const now = new Date("2026-08-29T15:00:00.000Z");
  const transition = parseOwnTracksTransition({
    _type: "transition",
    event: "enter",
    desc: "Buildr · Whole Home Remodel",
    wtst: ownTracksWaypointTimestamp(project.id),
    tst: 1788015000,
  }, now);
  assert.ok(transition);
  assert.equal(matchTransitionProject([project], transition), project);
});

test("does not match inactive Buildr jobs", () => {
  const now = new Date("2026-08-29T15:00:00.000Z");
  const transition = parseOwnTracksTransition({
    event: "leave",
    rid: `buildr-${project.id}`,
    tst: 1788015000,
  }, now);
  assert.ok(transition);
  assert.equal(matchTransitionProject([{ ...project, status: "complete" }], transition), null);
});

test("returns stable Android waypoints and moves completed jobs to an inert tombstone", () => {
  const completed = { ...project, id: "16039bd2-1279-4a89-9bd4-d85ad7842c6f", status: "complete" };
  const response = buildOwnTracksWaypointCommand([
    project,
    completed,
  ]);
  const command = response[0] as any;
  assert.equal(command.action, "setWaypoints");
  assert.equal(command.waypoints.waypoints[0].rad, 150);
  assert.equal(command.waypoints.waypoints[0].tst, ownTracksWaypointTimestamp(project.id));
  assert.equal(command.waypoints.waypoints[1].tst, ownTracksWaypointTimestamp(completed.id));
  assert.equal(command.waypoints.waypoints[1].rad, 1);
  assert.equal(command.waypoints.waypoints[1].lat, 0);
  assert.equal(command.waypoints.waypoints[1].lon, 0);
});
