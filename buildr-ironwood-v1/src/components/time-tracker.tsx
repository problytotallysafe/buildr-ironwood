"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Play, Plus, Square, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ProjectOption = {
  id: string;
  name: string | null;
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
  projects?: { name: string | null; estimates: { title: string | null } | null } | null;
};

const workCategories = [
  "General","Demolition","Framing","Plumbing","Electrical","Drywall","Painting",
  "Flooring","Tile","Cabinetry","Trim / Finish","Punch List","Travel / Pickup",
  "Estimate / Admin","Other",
];

function projectLabel(project: ProjectOption) {
  const title = project.estimates?.title || project.name || "Project";
  const customer = project.customers
    ? `${project.customers.first_name ?? ""} ${project.customers.last_name ?? ""}`.trim()
    : "";
  return customer ? `${title} — ${customer}` : title;
}

function durationMinutes(entry: TimeEntry) {
  if (entry.duration_minutes != null) return Number(entry.duration_minutes);
  if (!entry.ended_at) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000,
    ),
  );
}

function hoursText(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function TimeTracker({
  projects,
  teamMembers,
  entries,
}: {
  projects: ProjectOption[];
  teamMembers: TeamMember[];
  entries: TimeEntry[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const activeEntry = entries.find((entry) => !entry.ended_at) ?? null;

  const [projectId, setProjectId] = useState(activeEntry?.project_id ?? projects[0]?.id ?? "");
  const [workerType, setWorkerType] = useState(activeEntry?.team_member_id ?? "owner");
  const [category, setCategory] = useState(activeEntry?.work_category ?? "General");
  const [notes, setNotes] = useState("");
  const [mileage, setMileage] = useState(0);
  const [billable, setBillable] = useState(true);

  const [manualProjectId, setManualProjectId] = useState(projects[0]?.id ?? "");
  const [manualWorkerType, setManualWorkerType] = useState("owner");
  const [manualCategory, setManualCategory] = useState("General");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("08:00");
  const [manualHours, setManualHours] = useState(1);
  const [manualNotes, setManualNotes] = useState("");
  const [manualMileage, setManualMileage] = useState(0);
  const [manualBillable, setManualBillable] = useState(true);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberCost, setNewMemberCost] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    let minutes = 0;
    let laborCost = 0;
    let miles = 0;

    for (const entry of entries) {
      if (!entry.ended_at) continue;
      const mins = durationMinutes(entry);
      minutes += mins;
      laborCost += (mins / 60) * Number(entry.hourly_cost ?? 0);
      miles += Number(entry.mileage ?? 0);
    }

    return { minutes, laborCost, miles };
  }, [entries]);

  function workerDetails(value: string) {
    if (value === "owner") {
      return { team_member_id: null, worker_name: "Owner", hourly_cost: 0 };
    }

    const member = teamMembers.find((item) => item.id === value);
    return {
      team_member_id: member?.id ?? null,
      worker_name: member?.name ?? "Worker",
      hourly_cost: Number(member?.hourly_cost ?? 0),
    };
  }

  async function clockIn() {
    setError("");
    if (!projectId) return setError("Choose a project first.");
    if (activeEntry) return setError("Clock out before starting another timer.");

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError("Your session expired. Sign in again.");

      const worker = workerDetails(workerType);
      const { error: insertError } = await supabase.from("time_entries").insert({
        owner_id: user.id,
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

      const { error: updateError } = await supabase
        .from("time_entries")
        .update({
          ended_at: endedAt.toISOString(),
          duration_minutes: minutes,
          updated_at: endedAt.toISOString(),
        })
        .eq("id", activeEntry.id);

      if (updateError) return setError(updateError.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addManualEntry(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!manualProjectId) return setError("Choose a project.");
    if (manualHours <= 0) return setError("Hours must be greater than zero.");

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError("Your session expired. Sign in again.");

      const worker = workerDetails(manualWorkerType);
      const start = new Date(`${manualDate}T${manualStart}:00`);
      const minutes = Math.round(manualHours * 60);
      const end = new Date(start.getTime() + minutes * 60000);

      const { error: insertError } = await supabase.from("time_entries").insert({
        owner_id: user.id,
        project_id: manualProjectId,
        team_member_id: worker.team_member_id,
        worker_name: worker.worker_name,
        work_category: manualCategory,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_minutes: minutes,
        notes: manualNotes.trim() || null,
        mileage: manualMileage,
        billable: manualBillable,
        manual_entry: true,
        hourly_cost: worker.hourly_cost,
      });

      if (insertError) return setError(insertError.message);

      setManualHours(1);
      setManualNotes("");
      setManualMileage(0);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTeamMember(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!newMemberName.trim()) return setError("Enter a worker name.");

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError("Your session expired. Sign in again.");

      const { error: insertError } = await supabase.from("team_members").insert({
        owner_id: user.id,
        name: newMemberName.trim(),
        role: newMemberRole.trim() || null,
        hourly_cost: newMemberCost,
      });

      if (insertError) return setError(insertError.message);

      setNewMemberName("");
      setNewMemberRole("");
      setNewMemberCost(0);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this time entry?")) return;

    setBusy(true);
    try {
      const { error: deleteError } = await supabase.from("time_entries").delete().eq("id", id);
      if (deleteError) return setError(deleteError.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="time-tracker-stack">
      <section className="time-summary-grid">
        <article className="panel">
          <span className="time-summary-label">Recorded hours</span>
          <strong className="time-summary-number">{hoursText(totals.minutes)}</strong>
        </article>

        <article className="panel">
          <span className="time-summary-label">Internal labor cost</span>
          <strong className="time-summary-number">{formatMoney(totals.laborCost)}</strong>
        </article>

        <article className="panel">
          <span className="time-summary-label">Mileage</span>
          <strong className="time-summary-number">{totals.miles.toFixed(1)} mi</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Clock in / out</h2>
            <p>Track actual job time while you work.</p>
          </div>
          <Clock3 size={24} />
        </div>

        {activeEntry ? (
          <div className="active-timer-card">
            <div>
              <span className="time-summary-label">Currently clocked in</span>
              <strong>{activeEntry.worker_name}</strong>
              <p>
                {activeEntry.work_category} • Started{" "}
                {new Date(activeEntry.started_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <button className="button button--gold" type="button" disabled={busy} onClick={clockOut}>
              <Square size={17} />
              Clock out
            </button>
          </div>
        ) : (
          <div className="form-grid">
            <label className="span-2">
              Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Choose a project…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{projectLabel(project)}</option>
                ))}
              </select>
            </label>

            <label>
              Worker
              <select value={workerType} onChange={(e) => setWorkerType(e.target.value)}>
                <option value="owner">Owner</option>
                {teamMembers.filter((m) => m.active).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>

            <label>
              Work category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {workCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label className="span-2">
              Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <label>
              Mileage
              <input
                type="number"
                min="0"
                step="0.1"
                value={mileage === 0 ? "" : mileage}
                onChange={(e) => setMileage(e.target.value === "" ? 0 : Number(e.target.value))}
              />
            </label>

            <label className="checkbox">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
              Billable
            </label>

            <div className="span-2">
              <button className="button button--gold" type="button" disabled={busy || !projectId} onClick={clockIn}>
                <Play size={17} />
                Clock in
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-box">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Manual time entry</h2>
            <p>Add time after the fact.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={addManualEntry}>
          <label className="span-2">
            Project
            <select value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)}>
              <option value="">Choose a project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{projectLabel(project)}</option>
              ))}
            </select>
          </label>

          <label>
            Worker
            <select value={manualWorkerType} onChange={(e) => setManualWorkerType(e.target.value)}>
              <option value="owner">Owner</option>
              {teamMembers.filter((m) => m.active).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value)}>
              {workCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label>
            Date
            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
          </label>

          <label>
            Start time
            <input type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
          </label>

          <label>
            Hours
            <input
              type="number"
              min="0.01"
              step="0.25"
              value={manualHours === 0 ? "" : manualHours}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setManualHours(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>

          <label>
            Mileage
            <input
              type="number"
              min="0"
              step="0.1"
              value={manualMileage === 0 ? "" : manualMileage}
              onChange={(e) => setManualMileage(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>

          <label className="span-2">
            Notes
            <input value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
          </label>

          <label className="checkbox span-2">
            <input type="checkbox" checked={manualBillable} onChange={(e) => setManualBillable(e.target.checked)} />
            Billable
          </label>

          <div className="span-2">
            <button className="button button--outline" type="submit" disabled={busy}>
              <Plus size={17} />
              Add time
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Workers / helpers</h2>
            <p>Add helpers and their internal hourly labor cost.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={addTeamMember}>
          <label>
            Name
            <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
          </label>

          <label>
            Role
            <input value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} />
          </label>

          <label>
            Internal hourly cost
            <input
              type="number"
              min="0"
              step="0.01"
              value={newMemberCost === 0 ? "" : newMemberCost}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setNewMemberCost(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>

          <div className="time-worker-add">
            <button className="button button--outline" type="submit" disabled={busy}>
              <Plus size={17} />
              Add worker
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent time</h2>
            <p>Completed time entries across your projects.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Worker</th>
                <th>Work</th>
                <th>Hours</th>
                <th>Cost</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) => {
                const minutes = durationMinutes(entry);
                const title = entry.projects?.estimates?.title || entry.projects?.name || "Project";

                return (
                  <tr key={entry.id}>
                    <td>
                      {new Date(entry.started_at).toLocaleDateString()}
                      {entry.manual_entry && <small>Manual</small>}
                    </td>
                    <td>{title}</td>
                    <td>{entry.worker_name}</td>
                    <td>
                      {entry.work_category}
                      {entry.notes && <small>{entry.notes}</small>}
                    </td>
                    <td>{entry.ended_at ? hoursText(minutes) : "Running"}</td>
                    <td>
                      {entry.ended_at
                        ? formatMoney((minutes / 60) * Number(entry.hourly_cost ?? 0))
                        : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger"
                        disabled={busy || !entry.ended_at}
                        onClick={() => deleteEntry(entry.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!entries.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">No time recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
