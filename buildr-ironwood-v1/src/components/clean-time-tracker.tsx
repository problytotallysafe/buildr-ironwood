"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, Pencil, Play, Plus, Square, Trash2, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { businessDateInputValue, formatBusinessDate, formatBusinessTime } from "@/lib/date";
import { effectiveHourlyCost } from "@/lib/labor-cost";

type ProjectOption = {
  id: string;
  name: string | null;
  status: string;
  estimates: { title: string | null; estimate_number: string | null } | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  hourly_cost: number | string;
  active: boolean;
};

type TimeEntry = {
  id: string;
  project_id: string;
  team_member_id: string | null;
  worker_name: string;
  work_category: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  mileage: number | string | null;
  billable: boolean;
  manual_entry: boolean;
  hourly_cost: number | string | null;
  projects?: {
    name: string | null;
    estimates: { title: string | null } | null;
  } | null;
};

type Mode = "clock" | "manual" | "gps";

const workCategories = [
  "General",
  "Demolition",
  "Framing",
  "Plumbing",
  "Electrical",
  "Drywall",
  "Painting",
  "Flooring",
  "Tile",
  "Cabinetry",
  "Trim / Finish",
  "Punch List",
  "Travel / Pickup",
  "Estimate / Admin",
  "Other",
];

function projectLabel(project: ProjectOption) {
  const title = project.estimates?.title || project.name || "Project";
  const customer = project.customers
    ? `${project.customers.first_name ?? ""} ${project.customers.last_name ?? ""}`.trim()
    : "";
  return customer ? `${title} — ${customer}` : title;
}

function entryProjectLabel(entry: TimeEntry) {
  return entry.projects?.estimates?.title || entry.projects?.name || "Project";
}

function entryMinutes(entry: TimeEntry) {
  if (entry.duration_minutes != null) return Number(entry.duration_minutes);
  if (!entry.ended_at) return 0;
  return Math.max(0, Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000));
}

function formatHours(minutes: number) {
  const value = minutes / 60;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function timeValue(value: string) {
  return new Date(value).toTimeString().slice(0, 5);
}

export function CleanTimeTracker({
  projects,
  teamMembers,
  entries,
  selectedProject,
  ownerHourlyCost,
  canTrackOwner,
  canManageWorkers,
}: {
  projects: ProjectOption[];
  teamMembers: TeamMember[];
  entries: TimeEntry[];
  selectedProject?: string;
  ownerHourlyCost: number;
  canTrackOwner: boolean;
  canManageWorkers: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const activeMembers = teamMembers.filter((member) => member.active);
  const firstWorkerId = activeMembers[0]?.id ?? "";
  const firstRunningEntry = entries.find((entry) => !entry.ended_at) ?? null;
  const initialWorkerType = canTrackOwner ? firstRunningEntry?.team_member_id ?? "owner" : firstWorkerId;

  const [mode, setMode] = useState<Mode>(firstRunningEntry ? "clock" : "manual");
  const [workerType, setWorkerType] = useState(initialWorkerType);
  const activeEntry = entries.find((entry) => {
    if (entry.ended_at) return false;
    return workerType === "owner"
      ? canTrackOwner && entry.team_member_id == null
      : entry.team_member_id === workerType;
  }) ?? null;

  const defaultProject = activeEntry?.project_id ?? selectedProject ?? projects[0]?.id ?? "";
  const [projectId, setProjectId] = useState(defaultProject);
  const [category, setCategory] = useState(activeEntry?.work_category ?? "General");
  const [notes, setNotes] = useState("");
  const [mileage, setMileage] = useState(0);
  const [billable, setBillable] = useState(true);

  const [manualProjectId, setManualProjectId] = useState(selectedProject ?? projects[0]?.id ?? "");
  const [manualWorkerType, setManualWorkerType] = useState(initialWorkerType);
  const [manualCategory, setManualCategory] = useState("General");
  const [manualDate, setManualDate] = useState(businessDateInputValue());
  const [manualStart, setManualStart] = useState("08:00");
  const [manualFinish, setManualFinish] = useState("17:00");
  const [manualNotes, setManualNotes] = useState("");
  const [manualMileage, setManualMileage] = useState(0);
  const [manualBillable, setManualBillable] = useState(true);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const calculatedManualMinutes = useMemo(() => {
    if (!manualDate || !manualStart || !manualFinish) return 0;
    const start = new Date(`${manualDate}T${manualStart}:00`);
    const finish = new Date(`${manualDate}T${manualFinish}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish <= start) return 0;
    return Math.round((finish.getTime() - start.getTime()) / 60000);
  }, [manualDate, manualStart, manualFinish]);

  const totals = useMemo(() => {
    let minutes = 0;
    let laborCost = 0;
    let miles = 0;
    for (const entry of entries) {
      if (!entry.ended_at) continue;
      const mins = entryMinutes(entry);
      minutes += mins;
      laborCost += (mins / 60) * effectiveHourlyCost(entry, ownerHourlyCost);
      miles += Number(entry.mileage ?? 0);
    }
    return { minutes, laborCost, miles };
  }, [entries, ownerHourlyCost]);

  function workerDetails(value: string) {
    if (value === "owner") {
      return { team_member_id: null, worker_name: "Owner", hourly_cost: ownerHourlyCost };
    }
    const member = teamMembers.find((item) => item.id === value);
    return {
      team_member_id: member?.id ?? null,
      worker_name: member?.name ?? "Worker",
      hourly_cost: Number(member?.hourly_cost ?? 0),
    };
  }

  async function getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Sign in again.");
      return null;
    }
    return user.id;
  }

  async function clockIn() {
    setError("");
    if (!projectId) return setError("Choose a project first.");
    if (!workerType) return setError("Choose a worker first.");
    if (activeEntry) return setError("Clock out before starting another timer.");
    setBusy(true);
    try {
      const userId = await getUserId();
      if (!userId) return;
      const worker = workerDetails(workerType);
      const { error: insertError } = await supabase.from("time_entries").insert({
        owner_id: userId,
        project_id: projectId,
        team_member_id: worker.team_member_id,
        worker_name: worker.worker_name,
        work_category: category,
        started_at: new Date().toISOString(),
        notes: notes.trim() || null,
        mileage,
        billable,
        manual_entry: false,
        hourly_cost: worker.hourly_cost,
        clock_in_method: "manual",
      });
      if (insertError) return setError(insertError.message);
      setNotes("");
      setMileage(0);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (!activeEntry) return;
    setBusy(true);
    setError("");
    try {
      const endedAt = new Date();
      const startedAt = new Date(activeEntry.started_at);
      const minutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
      const { error: updateError } = await supabase.from("time_entries").update({
        ended_at: endedAt.toISOString(),
        duration_minutes: minutes,
        updated_at: endedAt.toISOString(),
      }).eq("id", activeEntry.id);
      if (updateError) return setError(updateError.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveManualEntry(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!manualProjectId) return setError("Choose a project.");
    if (!manualWorkerType) return setError("Choose a worker.");
    if (!manualDate || !manualStart || !manualFinish) return setError("Enter the date, start time, and finish time.");
    if (calculatedManualMinutes <= 0) return setError("Finish time must be after start time.");

    setBusy(true);
    try {
      const userId = await getUserId();
      if (!userId) return;
      const worker = workerDetails(manualWorkerType);
      const start = new Date(`${manualDate}T${manualStart}:00`);
      const finish = new Date(`${manualDate}T${manualFinish}:00`);
      const values = {
        project_id: manualProjectId,
        team_member_id: worker.team_member_id,
        worker_name: worker.worker_name,
        work_category: manualCategory,
        started_at: start.toISOString(),
        ended_at: finish.toISOString(),
        duration_minutes: calculatedManualMinutes,
        notes: manualNotes.trim() || null,
        mileage: manualMileage,
        billable: manualBillable,
        manual_entry: true,
        hourly_cost: worker.hourly_cost,
        clock_in_method: "manual",
      };

      const { error: saveError } = editingEntryId
        ? await supabase.from("time_entries").update(values).eq("id", editingEntryId)
        : await supabase.from("time_entries").insert({ owner_id: userId, ...values });
      if (saveError) return setError(saveError.message);

      setEditingEntryId(null);
      setManualNotes("");
      setManualMileage(0);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function editEntry(entry: TimeEntry) {
    if (!entry.ended_at) return;
    const start = new Date(entry.started_at);
    const finish = new Date(entry.ended_at);
    setEditingEntryId(entry.id);
    setManualProjectId(entry.project_id);
    setManualWorkerType(entry.team_member_id ?? "owner");
    setManualCategory(entry.work_category || "General");
    setManualDate(businessDateInputValue(start));
    setManualStart(timeValue(entry.started_at));
    setManualFinish(timeValue(entry.ended_at));
    setManualNotes(entry.notes ?? "");
    setManualMileage(Number(entry.mileage ?? 0));
    setManualBillable(entry.billable);
    setMode("manual");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this time entry?")) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.from("time_entries").delete().eq("id", id);
      if (deleteError) return setError(deleteError.message);
      if (editingEntryId === id) setEditingEntryId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function workerOptions(value: string, setter: (value: string) => void) {
    return (
      <select value={value} onChange={(event) => setter(event.target.value)}>
        {!canTrackOwner && <option value="">Choose worker…</option>}
        {canTrackOwner && <option value="owner">Owner</option>}
        {activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    );
  }

  function projectOptions(value: string, setter: (value: string) => void) {
    return (
      <select value={value} onChange={(event) => setter(event.target.value)}>
        <option value="">{projects.length ? "Choose a project…" : "No active projects"}</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
      </select>
    );
  }

  return (
    <div className="time-tracker-stack">
      <section className="time-summary-grid">
        <article className="panel"><span className="time-summary-label">Recorded hours</span><strong className="time-summary-number">{formatHours(totals.minutes)}</strong></article>
        <article className="panel"><span className="time-summary-label">Internal labor cost</span><strong className="time-summary-number">{formatMoney(totals.laborCost)}</strong></article>
        <article className="panel"><span className="time-summary-label">Mileage</span><strong className="time-summary-number">{totals.miles.toFixed(1)} mi</strong></article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Time tracking</h2><p>Choose what you need to do.</p></div>
          <Clock3 size={24} />
        </div>
        <label>
          Action
          <select value={mode} onChange={(event) => { setMode(event.target.value as Mode); setError(""); }}>
            <option value="clock">Clock in / out</option>
            <option value="manual">Manual time entry</option>
            <option value="gps">GPS / OwnTracks settings</option>
          </select>
        </label>
      </section>

      {mode === "clock" && (
        <section className="panel">
          <div className="panel-heading"><div><h2>Clock in / out</h2><p>Use this while you are actively working.</p></div><Play size={22} /></div>
          {activeEntry ? (
            <div className="active-timer-card">
              <div><span className="time-summary-label">Currently clocked in</span><strong>{activeEntry.worker_name}</strong><p>{activeEntry.work_category} • Started {formatBusinessTime(activeEntry.started_at)}</p></div>
              <button className="button button--gold" type="button" disabled={busy} onClick={clockOut}><Square size={17} />Clock out</button>
            </div>
          ) : (
            <div className="form-grid">
              <label className="span-2">Project{projectOptions(projectId, setProjectId)}</label>
              <label>Worker{workerOptions(workerType, setWorkerType)}</label>
              <label>Work category<select value={category} onChange={(event) => setCategory(event.target.value)}>{workCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="span-2">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <label>Mileage<input type="number" min="0" step="any" value={mileage || ""} onChange={(event) => setMileage(event.target.value === "" ? 0 : Number(event.target.value))} /></label>
              <label className="checkbox"><input type="checkbox" checked={billable} onChange={(event) => setBillable(event.target.checked)} />Billable</label>
              <div className="span-2"><button className="button button--gold" type="button" disabled={busy || !projectId || !workerType} onClick={clockIn}><Play size={17} />Clock in</button></div>
            </div>
          )}
        </section>
      )}

      {mode === "manual" && (
        <section className="panel">
          <div className="panel-heading">
            <div><h2>{editingEntryId ? "Edit time entry" : "Manual time entry"}</h2><p>Enter the start and finish time. Buildr calculates the hours for you.</p></div>
            {editingEntryId ? <Pencil size={22} /> : <Plus size={22} />}
          </div>
          <form className="form-grid" onSubmit={saveManualEntry}>
            <label className="span-2">Project{projectOptions(manualProjectId, setManualProjectId)}</label>
            <label>Worker{workerOptions(manualWorkerType, setManualWorkerType)}</label>
            <label>Category<select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}>{workCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Date<input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} /></label>
            <label>Start time<input type="time" value={manualStart} onChange={(event) => setManualStart(event.target.value)} /></label>
            <label>Finish time<input type="time" value={manualFinish} onChange={(event) => setManualFinish(event.target.value)} /></label>
            <label>Hours calculated<input type="text" readOnly value={calculatedManualMinutes > 0 ? formatHours(calculatedManualMinutes) : "—"} /></label>
            <label>Mileage<input type="number" min="0" step="any" value={manualMileage || ""} onChange={(event) => setManualMileage(event.target.value === "" ? 0 : Number(event.target.value))} /></label>
            <label className="checkbox"><input type="checkbox" checked={manualBillable} onChange={(event) => setManualBillable(event.target.checked)} />Billable</label>
            <label className="span-2">Notes<input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} /></label>
            <div className="span-2 button-row">
              <button className="button button--gold" type="submit" disabled={busy}>{editingEntryId ? "Save changes" : "Add time entry"}</button>
              {editingEntryId && <button className="button button--outline" type="button" onClick={() => setEditingEntryId(null)}><X size={16} />Cancel</button>}
            </div>
          </form>
        </section>
      )}

      {mode === "gps" && (
        <section className="panel">
          <div className="panel-heading"><div><h2>GPS / OwnTracks</h2><p>Manage automatic jobsite arrivals, departures, connection status, and jobsite geofences.</p></div><MapPin size={24} /></div>
          <p>OwnTracks is the automatic GPS source for Buildr. Use the GPS settings page to check the phone connection or change jobsite tracking.</p>
          <div className="button-row"><Link className="button button--gold" href="/settings/time#android-tracking">Open GPS settings</Link><Link className="button button--outline" href="/settings/time#jobsite-gps">Jobsite GPS setup</Link></div>
        </section>
      )}

      {error && <p className="error-box">{error}</p>}

      {ownerHourlyCost <= 0 && canManageWorkers && (
        <div className="settings-warning"><div><strong>Owner labor cost is not set.</strong><span>Time is recorded, but labor-cost reporting will be incomplete.</span></div><Link href="/settings/time">Set owner hourly cost</Link></div>
      )}

      <section className="panel">
        <div className="panel-heading"><div><h2>Recent entries</h2><p>Review, correct, or remove recorded time.</p></div>{canManageWorkers && <Link className="button button--outline" href="/settings/team">Manage workers</Link>}</div>
        {entries.length === 0 ? <p>No time entries yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Project</th><th>Worker</th><th>Time</th><th>Hours</th><th>Actions</th></tr></thead>
              <tbody>
                {entries.slice(0, 40).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatBusinessDate(entry.started_at)}</td>
                    <td>{entryProjectLabel(entry)}</td>
                    <td>{entry.worker_name}</td>
                    <td>{formatBusinessTime(entry.started_at)}{entry.ended_at ? ` – ${formatBusinessTime(entry.ended_at)}` : " – running"}</td>
                    <td>{entry.ended_at ? formatHours(entryMinutes(entry)) : "—"}</td>
                    <td><div className="button-row"><button className="icon-button" type="button" title="Edit" disabled={!entry.ended_at || busy} onClick={() => editEntry(entry)}><Pencil size={16} /></button><button className="icon-button" type="button" title="Delete" disabled={busy} onClick={() => deleteEntry(entry.id)}><Trash2 size={16} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
