import Link from "next/link";
import { Save } from "lucide-react";

import { businessDateInputValue } from "@/lib/date";
import {
  callbackResponsibilityOptions,
  callbackWarrantyOptions,
} from "@/lib/project-callbacks";

export function ProjectCallbackForm({
  action,
  project,
  callback,
  editable = true,
}: {
  action: (formData: FormData) => Promise<void>;
  project: { id: string; title: string; customerName: string };
  callback?: any;
  editable?: boolean;
}) {
  return (
    <form action={action} className="stack">
      <input type="hidden" name="project_id" value={project.id}/>
      <fieldset className="callback-fields stack" disabled={!editable}>

      <section className="panel form-grid">
        <div className="span-2"><div className="eyebrow">Customer callback</div><h2>{project.title}</h2><p className="muted">{project.customerName}</p></div>
        <label className="span-2">Callback title<input name="title" required maxLength={160} defaultValue={callback?.title ?? ""} placeholder="Shower door leak, cabinet adjustment, drywall crack…"/></label>
        <label>Reported date<input name="reported_at" type="date" required defaultValue={callback?.reported_at ?? businessDateInputValue()}/></label>
        <label>Scheduled repair date<input name="scheduled_for" type="date" defaultValue={callback?.scheduled_for ?? ""}/></label>
        <label className="span-2">What problem did the customer report?<textarea name="issue_description" required rows={6} maxLength={10000} defaultValue={callback?.issue_description ?? ""} placeholder="Describe what happened, when it started, and anything the homeowner observed."/></label>
      </section>

      <section className="panel form-grid">
        <div className="span-2"><div className="eyebrow">Responsibility & cost</div><h2>Warranty and financial impact</h2></div>
        <label>Warranty decision<select name="warranty_status" defaultValue={callback?.warranty_status ?? "under_review"}>{callbackWarrantyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Who is responsible for the cost?<select name="cost_responsibility" defaultValue={callback?.cost_responsibility ?? "undetermined"}>{callbackResponsibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Estimated Ironwood cost<input name="estimated_internal_cost" type="number" min="0" step="0.01" defaultValue={callback?.estimated_internal_cost ?? 0}/><small>Labor, material, subcontractor, and trip cost to Ironwood.</small></label>
        <label>Homeowner charge<input name="homeowner_amount" type="number" min="0" step="0.01" defaultValue={callback?.homeowner_amount ?? 0}/><small>Use $0 for warranty work covered by Ironwood.</small></label>
        <label>Actual Ironwood cost<input name="actual_internal_cost" type="number" min="0" step="0.01" defaultValue={callback?.actual_internal_cost ?? ""}/><small>Leave blank until known; reports will use the estimate.</small></label>
        <div className="callback-financial-note"><strong>Profit stays conservative</strong><span>Only accepted or completed callbacks affect the job totals. Customer charges add revenue; Ironwood costs reduce projected profit.</span></div>
      </section>

      <section className="panel form-grid">
        <div className="span-2"><div className="eyebrow">Repair record</div><h2>Plan and approval</h2></div>
        <label className="span-2">Repair plan<textarea name="repair_plan" rows={6} defaultValue={callback?.repair_plan ?? ""} placeholder="What will be inspected or repaired, who will handle it, and what needs to be ordered?"/></label>
        <label>Accepted by<input name="accepted_by_name" defaultValue={callback?.accepted_by_name ?? ""} placeholder="Homeowner or Ironwood approver"/></label>
        <label>Acceptance note<input name="acceptance_note" defaultValue={callback?.acceptance_note ?? ""} placeholder="Approved by text, warranty confirmed…"/></label>
        <label className="span-2">Private Ironwood notes<textarea name="private_notes" rows={4} defaultValue={callback?.private_notes ?? ""} placeholder="Internal observations, vendor conversations, or follow-up details."/></label>
      </section>
      </fieldset>

      <div className="form-actions button-row">
        <Link href={`/projects/${project.id}#callbacks`} className="button button--outline">Back to project</Link>
        {editable && <button className="button button--gold"><Save size={16}/>{callback ? "Save callback" : "Create callback"}</button>}
      </div>
    </form>
  );
}
