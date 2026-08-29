"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, Navigation, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type GpsProject = {
  id: string;
  name: string | null;
  project_address: string | null;
  jobsite_latitude: number | null;
  jobsite_longitude: number | null;
  geofence_radius_meters: number | null;
  gps_clock_in_enabled: boolean;
  estimates: { title: string | null } | null;
};

const deviceKey = "buildr-gps-clock-in-enabled";
const settingsEvent = "buildr-gps-settings-changed";

function projectName(project: GpsProject) {
  return project.estimates?.title || project.name || "Project";
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6_371_000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locate(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function GpsClockInAgent({
  ownerId,
  ownerHourlyCost,
  projects,
  hasActiveTime,
}: {
  ownerId: string;
  ownerHourlyCost: number;
  projects: GpsProject[];
  hasActiveTime: boolean;
}) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const pendingProject = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const sync = () => setEnabled(window.localStorage.getItem(deviceKey) === "true");
    sync();
    window.addEventListener(settingsEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(settingsEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled || hasActiveTime || !projects.length || !navigator.geolocation) {
      return;
    }

    let cancelled = false;
    let watchId: number | null = null;

    const clearPending = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      pendingProject.current = null;
    };

    const evaluate = (position: GeolocationPosition) => {
      if (cancelled) return;
      const { latitude, longitude, accuracy } = position.coords;
      const match = projects
        .map((project) => ({
          project,
          distance: distanceMeters(
            latitude,
            longitude,
            Number(project.jobsite_latitude),
            Number(project.jobsite_longitude),
          ),
        }))
        .filter(({ project, distance }) =>
          project.jobsite_latitude != null
          && project.jobsite_longitude != null
          && distance <= Math.max(Number(project.geofence_radius_meters ?? 150), accuracy),
        )
        .sort((a, b) => a.distance - b.distance)[0];

      if (!match) {
        clearPending();
        setStatus("GPS ready · away from saved jobsites");
        return;
      }

      if (pendingProject.current === match.project.id) return;
      clearPending();
      pendingProject.current = match.project.id;
      setStatus(`At ${projectName(match.project)} · confirming arrival`);

      timer.current = window.setTimeout(async () => {
        try {
          const confirmation = await locate({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 });
          const confirmedDistance = distanceMeters(
            confirmation.coords.latitude,
            confirmation.coords.longitude,
            Number(match.project.jobsite_latitude),
            Number(match.project.jobsite_longitude),
          );
          const fence = Math.max(Number(match.project.geofence_radius_meters ?? 150), confirmation.coords.accuracy);
          if (confirmedDistance > fence) {
            setStatus("GPS ready · arrival was not confirmed");
            clearPending();
            return;
          }

          const cooldownKey = `buildr-gps-clock-in-${match.project.id}`;
          const lastClockIn = Number(window.localStorage.getItem(cooldownKey) || 0);
          if (Date.now() - lastClockIn < 30 * 60 * 1000) {
            setStatus(`GPS ready · ${projectName(match.project)} is in cooldown`);
            clearPending();
            return;
          }

          const supabase = createClient();
          const { count } = await supabase
            .from("time_entries")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", ownerId)
            .is("team_member_id", null)
            .is("ended_at", null);
          if (count) {
            clearPending();
            router.refresh();
            return;
          }

          const { error } = await supabase.from("time_entries").insert({
            owner_id: ownerId,
            project_id: match.project.id,
            team_member_id: null,
            worker_name: "Owner",
            work_category: "General",
            started_at: new Date().toISOString(),
            mileage: 0,
            billable: true,
            manual_entry: false,
            hourly_cost: ownerHourlyCost,
            clock_in_method: "gps",
            clock_in_latitude: confirmation.coords.latitude,
            clock_in_longitude: confirmation.coords.longitude,
            clock_in_accuracy_meters: confirmation.coords.accuracy,
            notes: "GPS-assisted clock-in",
          });
          if (error) throw error;
          window.localStorage.setItem(cooldownKey, String(Date.now()));
          window.localStorage.setItem("buildr-last-project", match.project.id);
          setStatus(`Clocked in at ${projectName(match.project)}`);
          router.refresh();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "GPS clock-in could not start.");
        } finally {
          clearPending();
        }
      }, 60_000);
    };

    const statusTimer = window.setTimeout(() => setStatus("GPS ready · checking nearby jobsites"), 0);
    watchId = navigator.geolocation.watchPosition(
      evaluate,
      (error) => setStatus(error.code === 1 ? "Location permission is off" : "Waiting for a reliable GPS signal"),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 },
    );

    return () => {
      cancelled = true;
      window.clearTimeout(statusTimer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearPending();
    };
  }, [enabled, hasActiveTime, ownerHourlyCost, ownerId, projects, router]);

  if (!enabled || hasActiveTime || !projects.length) return null;
  return <div className="gps-agent-bar"><Navigation size={15} /><span>{status}</span><LinkToTime /></div>;
}

function LinkToTime() {
  return <a href="/settings/time#gps-clock-in">GPS settings</a>;
}

export function GpsClockInSettings({ projects }: { projects: GpsProject[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [radius, setRadius] = useState(150);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeviceEnabled(window.localStorage.getItem(deviceKey) === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleDevice() {
    const next = !deviceEnabled;
    setDeviceEnabled(next);
    window.localStorage.setItem(deviceKey, String(next));
    window.dispatchEvent(new Event(settingsEvent));
    setMessage(next ? "GPS clock-in is enabled on this device." : "GPS clock-in is off on this device.");
  }

  async function saveCurrentLocation() {
    if (!projectId) return;
    if (!navigator.geolocation) {
      setMessage("This device does not provide browser location access.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const position = await locate({ enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 });
      const { error } = await createClient()
        .from("projects")
        .update({
          jobsite_latitude: position.coords.latitude,
          jobsite_longitude: position.coords.longitude,
          geofence_radius_meters: radius,
          gps_clock_in_enabled: true,
        })
        .eq("id", projectId);
      if (error) throw error;
      setMessage("Jobsite saved. Enable this device to use automatic arrival clock-in.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this location.");
    } finally {
      setBusy(false);
    }
  }

  async function disableProject() {
    if (!projectId) return;
    setBusy(true);
    const { error } = await createClient().from("projects").update({ gps_clock_in_enabled: false }).eq("id", projectId);
    setBusy(false);
    setMessage(error ? error.message : "GPS clock-in disabled for this project.");
    if (!error) router.refresh();
  }

  const selected = projects.find((project) => project.id === projectId);

  return (
    <section className="panel gps-settings" id="gps-clock-in">
      <div className="panel-heading"><div><span className="eyebrow">Optional</span><h2>GPS clock-in</h2></div><MapPin /></div>
      <div className="gps-device-row">
        <div><strong>This phone</strong><span>{deviceEnabled ? "Automatic arrival clock-in is on" : "Automatic arrival clock-in is off"}</span></div>
        <button type="button" className={deviceEnabled ? "button button--gold" : "button button--outline"} onClick={toggleDevice}><Power size={16} />{deviceEnabled ? "Enabled" : "Enable"}</button>
      </div>
      <div className="form-grid">
        <label className="span-2">Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{projectName(project)}</option>)}</select></label>
        <label>Arrival radius<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}><option value={100}>100 m</option><option value={150}>150 m</option><option value={250}>250 m</option><option value={400}>400 m</option></select></label>
        <div className="gps-location-state"><span>Saved jobsite</span><strong>{selected?.gps_clock_in_enabled ? "Active" : "Not set"}</strong><small>{selected?.project_address || "No address saved"}</small></div>
      </div>
      <div className="button-row"><button type="button" className="button button--gold" disabled={busy || !projectId} onClick={saveCurrentLocation}><Crosshair size={16} />{busy ? "Locating…" : "Use my current location"}</button>{selected?.gps_clock_in_enabled && <button type="button" className="button button--outline" disabled={busy} onClick={disableProject}>Disable for project</button>}</div>
      <p className="gps-limit-note">For privacy, location is checked only after you enable it on this phone. Automatic clock-in works while Buildr is open; Android and iPhone browsers cannot reliably track a jobsite after the app is fully closed.</p>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
