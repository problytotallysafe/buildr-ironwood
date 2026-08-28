import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import {
  isProjectStatus,
  PROJECT_STATUS_OPTIONS,
} from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

async function saveProject(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !isProjectStatus(status)) return;
  const value = (name: string) =>
    String(formData.get(name) ?? "").trim() || null;
  const { error } = await supabase
    .from("projects")
    .update({
      name: value("name"),
      status,
      project_address: value("project_address"),
      target_start_date: value("target_start_date"),
      target_end_date: value("target_end_date"),
      schedule_notes: value("schedule_notes"),
      private_notes: value("private_notes"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/time");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  redirect(`/projects/${id}`);
}

export default async function EditProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*,customers(first_name,last_name),estimates(title)")
    .eq("id", id)
    .single();
  if (!project) notFound();

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader
        eyebrow="Editable project record"
        title={project.estimates?.title || project.name}
        description={`${project.customers?.first_name ?? ""} ${project.customers?.last_name ?? ""}`.trim()}
      />
      <form action={saveProject} className="panel form-grid">
        <input type="hidden" name="id" value={id} />
        <label className="span-2">
          Project name
          <input name="name" defaultValue={project.name} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={project.status}>
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Project address
          <input
            name="project_address"
            defaultValue={project.project_address ?? ""}
          />
        </label>
        <label>
          Target start
          <input
            type="date"
            name="target_start_date"
            defaultValue={project.target_start_date ?? ""}
          />
        </label>
        <label>
          Target finish
          <input
            type="date"
            name="target_end_date"
            defaultValue={project.target_end_date ?? ""}
          />
        </label>
        <label className="span-2">
          Schedule notes
          <textarea
            name="schedule_notes"
            rows={4}
            defaultValue={project.schedule_notes ?? ""}
          />
        </label>
        <label className="span-2">
          Private notes
          <textarea
            name="private_notes"
            rows={5}
            defaultValue={project.private_notes ?? ""}
          />
        </label>
        <div className="form-actions button-row span-2">
          <Link href={`/projects/${id}`} className="button button--outline">
            Cancel
          </Link>
          <button className="button button--gold">Save project changes</button>
        </div>
      </form>
    </div>
  );
}
