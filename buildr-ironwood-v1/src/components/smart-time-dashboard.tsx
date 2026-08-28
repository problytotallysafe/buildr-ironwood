"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Play, Square, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type ProjectOption = {
  id: string;
  name: string | null;
  project_address: string | null;
  estimates: { title: string | null } | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

type TimeEntry = {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  projects?: { name: string | null; estimates: { title: string | null } | null } | null;
};

function projectLabel(project: ProjectOption) {
  return project.estimates?.title || project.name || "Project";
}

function minutesFor(entry: TimeEntry, now = Date.now()) {
  if (entry.ended_at && entry.duration_minutes != null) return Number(entry.duration_minutes);
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
  return Math.max(0, Math.round((end - new Date(entry.started_at).getTime()) / 60000));
}

function durationText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function previousWorkday(now: Date) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  do {
    date.setDate(date.getDate() - 1);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return date;
}

export function SmartTimeDashboard({
  projects,
  entries,
}: {
  projects: ProjectOption[];
  entries: TimeEntry[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const activeEntry = entries.find((entry) => !entry.ended_at) ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(activeEntry?.project_id ?? projects[0]?.id ?? "");

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const remembered = window.localStorage.getItem("buildr-last-project");
      if (!activeEntry && remembered && projects.some((project) => project.id === remembered)) setProjectId(remembered);
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearTimeout(restoreTimer);
      window.clearInterval(timer);
    };
  }, [activeEntry, projects]);

  const summary = useMemo(() => {
    const current = new Date(now);
    const todayKey = current.toDateString();
    const monday = new Date(current);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    const todayMinutes = entries
      .filter((entry) => new Date(entry.started_at).toDateString() === todayKey)
      .reduce((sum, entry) => sum + minutesFor(entry, now), 0);
    const weekMinutes = entries
      .filter((entry) => new Date(entry.started_at) >= monday)
      .reduce((sum, entry) => sum + minutesFor(entry, now), 0);

    const previous = previousWorkday(current);
    const previousKey = previous.toDateString();
    const previousHasTime = entries.some((entry) => new Date(entry.started_at).toDateString() === previousKey);
    const weekday = current.getDay() >= 1 && current.getDay() <= 5;

    return {
      todayMinutes,
      weekMinutes,
      morningReminder: weekday && current.getHours() >= 8 && todayMinutes === 0 && !activeEntry,
      eveningReminder: Boolean(activeEntry && current.getHours() >= 17),
      missingPrevious: weekday && !previousHasTime,
      previousLabel: previous.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    };
  }, [activeEntry, entries, now]);

  async function clockIn() {
    if (!projectId || activeEntry) return;
    setBusy(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");
      const { error: insertError } = await supabase.from("time_entries").insert({
        owner_id: user.id,
        project_id: projectId,
        team_member_id: null,
        worker_name: "Owner",
        work_category: "General",
        started_at: new Date().toISOString(),
        mileage: 0,
        billable: true,
        manual_entry: false,
        hourly_cost: 0,
      });
      if (insertError) throw insertError;
      window.localStorage.setItem("buildr-last-project", projectId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the timer.");
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (!activeEntry) return;
    setBusy(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");
      const endedAt = new Date();
      const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - new Date(activeEntry.started_at).getTime()) / 60000));
      const { error: updateError } = await supabase
        .from("time_entries")
        .update({ ended_at: endedAt.toISOString(), duration_minutes: durationMinutes, updated_at: endedAt.toISOString() })
        .eq("id", activeEntry.id)
        .eq("owner_id", user.id);
      if (updateError) throw updateError;
      window.localStorage.setItem("buildr-last-project", activeEntry.project_id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop the timer.");
    } finally {
      setBusy(false);
    }
  }

  const activeProject = projects.find((project) => project.id === activeEntry?.project_id);

  return (
    <section className="panel" style={{ marginBottom: 22, border: "1px solid rgba(193,154,64,.42)" }}>
      <div className="panel-heading" style={{ alignItems: "flex-start" }}>
        <div>
          <span style={{ display: "inline-flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: .72 }}>
            <Clock3 size={15} /> Smart time clock
          </span>
          <h2 style={{ marginTop: 7 }}>{activeEntry ? "You’re on the clock." : "Time clock"}</h2>
          {activeEntry && <strong style={{ display: "block", marginTop: 8, color: "var(--green)" }}>{activeProject ? projectLabel(activeProject) : "Active project"}</strong>}
        </div>
        <div style={{ textAlign: "right", minWidth: 110 }}>
          <strong style={{ display: "block", fontSize: 24 }}>{durationText(activeEntry ? minutesFor(activeEntry, now) : summary.todayMinutes)}</strong>
          <small>{activeEntry ? "running now" : "today"}</small>
        </div>
      </div>

      {!activeEntry ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "end" }}>
          <label style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              style={{ width: "100%", minHeight: 46 }}
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
            </select>
          </label>
          <button className="button button--gold" type="button" onClick={clockIn} disabled={busy || !projectId} style={{ minHeight: 46 }}>
            <Play size={17} /> {busy ? "Starting…" : "Start Work"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="button button--gold" type="button" onClick={clockOut} disabled={busy}>
            <Square size={16} /> {busy ? "Clocking out…" : "Clock Out"}
          </button>
          <Link className="button button--outline" href={`/time?project=${activeEntry.project_id}`}>Open time details</Link>
        </div>
      )}

      {error && <p style={{ marginTop: 12, color: "#a33", fontWeight: 700 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16 }}>
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(127,127,127,.07)" }}><small>Today</small><strong style={{ display: "block", fontSize: 19 }}>{durationText(summary.todayMinutes)}</strong></div>
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(127,127,127,.07)" }}><small>This week</small><strong style={{ display: "block", fontSize: 19 }}>{durationText(summary.weekMinutes)}</strong></div>
      </div>

      {(summary.morningReminder || summary.eveningReminder || summary.missingPrevious) && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(193,154,64,.10)", display: "grid", gap: 6 }}>
          {summary.morningReminder && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><TriangleAlert size={16} /><span>No time has been started today. If you’re working, clock in now.</span></div>}
          {summary.eveningReminder && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><TriangleAlert size={16} /><span>You’re still clocked in. Keep it running if you’re still working; otherwise clock out.</span></div>}
          {summary.missingPrevious && <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><TriangleAlert size={16} />No time was recorded for {summary.previousLabel}.</span><Link href={`/time${projectId ? `?project=${projectId}` : ""}`} style={{ fontWeight: 800 }}>Add forgotten time →</Link></div>}
        </div>
      )}
    </section>
  );
}
