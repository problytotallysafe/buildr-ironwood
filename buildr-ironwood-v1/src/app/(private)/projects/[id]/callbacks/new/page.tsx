import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PageHeader } from "@/components/page-header";
import { ProjectCallbackForm } from "@/components/project-callback-form";
import { canManageSales, getBusinessAccess } from "@/lib/business-access";
import { callbackFormValues } from "@/lib/project-callbacks";
import { createClient } from "@/lib/supabase/server";

export default async function NewProjectCallbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access || !canManageSales(access)) redirect(`/projects/${id}`);

  const { data: project } = await supabase
    .from("projects")
    .select("id,owner_id,name,status,customers(first_name,last_name),estimates(title)")
    .eq("id", id)
    .eq("owner_id", access.ownerId)
    .single();
  if (!project) notFound();

  const customer = project.customers as any;
  const estimate = project.estimates as any;
  const projectTitle = estimate?.title || project.name || "Completed project";
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer";

  if (project.status !== "complete") {
    return <div className="page-wrap page-wrap--narrow"><PageHeader eyebrow="Customer callback" title="Finish the project first"/><section className="panel"><p>Callbacks are for warranty or repair issues reported after a project is complete.</p><Link href={`/projects/${id}`} className="button button--gold">Back to project</Link></section></div>;
  }

  async function createCallback(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canManageSales(currentAccess)) redirect(`/projects/${id}`);
    const values = callbackFormValues(formData);
    if (!values) throw new Error("Enter a title, reported date, problem description, warranty decision, and cost responsibility.");

    const { data: completedProject } = await client
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("owner_id", currentAccess.ownerId)
      .eq("status", "complete")
      .maybeSingle();
    if (!completedProject) throw new Error("Callbacks can only be added to completed projects.");

    const { data, error } = await client.from("project_callbacks").insert({
      owner_id: currentAccess.ownerId,
      project_id: id,
      callback_number: "",
      status: "draft",
      ...values,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message || "Could not create the callback.");

    revalidatePath(`/projects/${id}`);
    revalidatePath("/analytics");
    revalidatePath("/today");
    revalidatePath("/dashboard");
    redirect(`/callbacks/${data.id}`);
  }

  return <div className="page-wrap"><PageHeader eyebrow="Post-completion service" title="New callback"/><ProjectCallbackForm action={createCallback} project={{ id, title: projectTitle, customerName }}/></div>;
}
