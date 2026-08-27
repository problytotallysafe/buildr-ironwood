import Link from "next/link";
import { Save } from "lucide-react";
import { CustomerSelect } from "@/components/customer-select";

export function SiteVisitForm({ action, customers, projects, estimates, worksheet, defaultCustomerId = "" }: {
  action: (formData: FormData) => Promise<void>;
  customers: any[];
  projects: any[];
  estimates: any[];
  worksheet?: any;
  defaultCustomerId?: string;
}) {
  const customerId = worksheet?.customer_id ?? defaultCustomerId;
  const area = (name: string, label: string, placeholder: string, rows = 4) => <label className="span-2">{label}<textarea name={name} rows={rows} defaultValue={worksheet?.[name] ?? ""} placeholder={placeholder}/></label>;
  return <form action={action} className="stack">
    <section className="panel form-grid">
      <label>Customer<CustomerSelect customers={customers} defaultValue={customerId}/></label>
      <label>Visit date<input type="date" name="visit_date" required defaultValue={worksheet?.visit_date ?? new Date().toISOString().slice(0, 10)}/></label>
      <label>Project type<input name="project_type" defaultValue={worksheet?.project_type ?? ""} placeholder="Bathroom, kitchen, whole home…"/></label>
      <label>People present<input name="people_present" defaultValue={worksheet?.people_present ?? ""} placeholder="Homeowners, designer, subcontractor…"/></label>
      <label>Existing project (optional)<select name="project_id" defaultValue={worksheet?.project_id ?? ""}><option value="">Not linked yet</option>{projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Existing estimate (optional)<select name="estimate_id" defaultValue={worksheet?.estimate_id ?? ""}><option value="">Not linked yet</option>{estimates.map((estimate: any) => <option key={estimate.id} value={estimate.id}>{estimate.estimate_number} — {estimate.title}</option>)}</select></label>
    </section>
    <section className="panel form-grid"><div className="span-2"><div className="eyebrow">Listen first</div><h2>What problem are we solving?</h2></div>{area("client_goals", "Customer goals and priorities", "What is not working now? What would make daily life better? What matters most if budget requires choices?", 6)}{area("selections_discussed", "Finishes or products discussed", "Brands, colors, fixtures, owner-supplied products, allowances, or decisions still open.")}</section>
    <section className="panel form-grid"><div className="span-2"><div className="eyebrow">Document the house</div><h2>Measurements and existing conditions</h2></div>{area("measurements", "Measurements", "Room dimensions, ceilings, openings, fixture centers, cabinet runs, square footage, and critical clearances.", 7)}{area("existing_conditions", "Existing conditions", "Framing, subfloor, water damage, level/plumb concerns, finishes to remain, and anything concealed or uncertain.", 6)}{area("plumbing_notes", "Plumbing", "Supply/drain locations, shutoffs, venting, fixture moves, water heater, access.")}{area("electrical_notes", "Electrical", "Panel capacity, circuits, outlets, lighting, switches, GFCI/AFCI, appliance requirements.")}{area("hvac_notes", "HVAC / ventilation", "Registers, returns, bath fans, duct changes, equipment conflicts.")}</section>
    <section className="panel form-grid"><div className="span-2"><div className="eyebrow">Plan the work</div><h2>Access, unknowns, and follow-up</h2></div>{area("access_protection", "Access and protection", "Parking, material path, pets, occupied areas, dust control, floor protection, work hours, dumpster and restroom.")}{area("photo_notes", "Photo checklist / notes", "Wide room views, every wall, utilities, problem areas, model numbers, panel, access route. Note anything not photographed.")}{area("unanswered_questions", "Unanswered questions", "Anything that must be verified before pricing or promised in writing.")}{area("follow_up_items", "Follow-up items", "Vendor pricing, subcontractor visit, product research, customer decision, permit check, second measurement.")}<label>Status<select name="status" defaultValue={worksheet?.status ?? "draft"}><option value="draft">Draft — follow-up needed</option><option value="complete">Complete — ready to estimate</option></select></label></section>
    <div className="form-actions button-row"><Link href="/site-visits" className="button button--outline">Cancel</Link>{worksheet && <Link className="button button--outline" href={`/estimates/new?setup=1&customer=${customerId}&projectType=other&siteVisit=${worksheet.id}`}>Create estimate from visit</Link>}<button className="button button--gold"><Save size={16}/>{worksheet ? "Save worksheet changes" : "Save site visit"}</button></div>
  </form>;
}
