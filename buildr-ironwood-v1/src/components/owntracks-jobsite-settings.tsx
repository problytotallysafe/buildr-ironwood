"use client";

import { useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type OwnTracksProject = {
  id: string;
  name: string | null;
  project_address: string | null;
  jobsite_latitude: number | null;
  jobsite_longitude: number | null;
  geofence_radius_meters: number | null;
  gps_clock_in_enabled: boolean;
  estimates: { title: string | null } | null;
};

function projectName(project: OwnTracksProject) {
  return project.estimates?.title || project.name || "Project";
}

function locate(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function OwnTracksJobsiteSettings({ projects }: { projects: OwnTracksProject[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const selected = projects.find((project) => project.id === projectId);
  const [radius, setRadius] = useState(Number(selected?.geofence_radius_meters ?? 150));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function selectProject(id: string) {
    setProjectId(id);
    const project = projects.find((item) => item.id === id);
    setRadius(Number(project?.geofence_radius_meters ?? 150));
    setMessage("");
  }

  async function saveCurrentLocation() {
    if (!projectId) return;
    if (!navigator.geolocation) {
      setMessage("This phone does not provide location access.");
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
      setMessage("OwnTracks jobsite saved. Open OwnTracks and publish once to sync this waypoint now.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this jobsite.");
    } finally {
      setBusy(false);
    }
  }

  async function disableProject() {
    if (!projectId) return;
    setBusy(true);
    const { error } = await createClient()
      .from("projects")
      .update({ gps_clock_in_enabled: false })
      .eq("id", projectId);
    setBusy(false);
    setMessage(error
      ? error.message
      : "OwnTracks tracking disabled for this jobsite. Publish once in OwnTracks to remove it from the phone.");
    if (!error) router.refresh();
  }

  return (
    <section className="panel gps-settings" id="owntracks-jobsites">
      <div className="panel-heading">
        <div><span className="eyebrow">OwnTracks waypoints</span><h2>Tracked jobsites</h2></div>
        <MapPin />
      </div>
      <p className="gps-limit-note">
        Buildr uses these locations only to create OwnTracks geofences. The old browser GPS clock-in is disabled, so there is only one automatic time source.
      </p>
      <div className="form-grid">
        <label className="span-2">Active project
          <select value={projectId} onChange={(event) => selectProject(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{projectName(project)}</option>)}
          </select>
        </label>
        <label>Arrival radius
          <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
            <option value={100}>100 m</option>
            <option value={150}>150 m</option>
            <option value={250}>250 m</option>
            <option value={400}>400 m</option>
          </select>
        </label>
        <div className="gps-location-state">
          <span>OwnTracks waypoint</span>
          <strong>{selected?.gps_clock_in_enabled ? "Active" : "Not set"}</strong>
          <small>{selected?.project_address || "No address saved"}</small>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="button button--gold" disabled={busy || !projectId} onClick={saveCurrentLocation}>
          <Crosshair size={16} />{busy ? "Locating…" : "Use my current location"}
        </button>
        {selected?.gps_clock_in_enabled && (
          <button type="button" className="button button--outline" disabled={busy} onClick={disableProject}>
            Stop tracking this jobsite
          </button>
        )}
      </div>
      <p className="gps-limit-note">
        New, changed, or removed jobsites update automatically the next time OwnTracks contacts Buildr. To update immediately, open OwnTracks and tap Publish once.
      </p>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
