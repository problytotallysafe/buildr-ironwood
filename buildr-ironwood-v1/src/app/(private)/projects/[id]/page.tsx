import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";

import { LaborVsActual } from "@/components/labor-vs-actual";
import { PageHeader } from "@/components/page-header";
import { ProjectMedia } from "@/components/project-media";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`*,customers(first_name,last_name),estimates(id,estimate_number,title,total,project_address,scope,payment_schedule)`)
    .eq("id", id)
    .single();

  if (error) console.error("PROJECT LOAD ERROR:", error);
  if (!project) notFound();

  const customer = project.customers as any;
  const estimate = project.estimates as any;
  const estimateId = estimate?.id ?? null;

  const [{ data: mediaRows }, { data: laborItems }, { data: timeEntries }] = await Promise.all([
    supabase
      .from("project_media")
      .select("id,storage_path,file_name,category,room_location,caption,customer_visible,created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    estimateId
      ? supabase
          .from("estimate_items")
          .select("id,description,category,quantity,unit,unit_cost,markup_rate")
          .eq("estimate_id", estimateId)
          .eq("item_type", "labor")
          .order("sort_order")
      : Promise.resolve({ data: [] } as any),
    supabase
      .from("time_entries")
      .select("id,work_category,duration_minutes,ended_at,hourly_cost")
      .eq("project_id", id)
      .order("started_at", { ascending: true }),
  ]);

  const media = await Promise.all((mediaRows ?? []).map(async (item) => {
    const { data } = await supabase.storage.from("project-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signed_url: data?.signedUrl ?? null };
  }));

  const title = estimate?.title || project.name || "Project";
  const address = estimate?.project_address || null;
  const contractTotal = Number(project.contract_total ?? estimate?.total ?? 0);
  const amountPaid = Number(project.amount_paid ?? 0);
  const remaining = Math.max(0, contractTotal - amountPaid);

  return (
    <div className="page-wrap">
      <div className="project-detail-back">
        <Link href="/projects"><ArrowLeft size={16}/>Back to projects</Link>
      </div>

      <PageHeader
        eyebrow={estimate?.estimate_number || "Project"}
        title={title}
        description={
          customer
            ? `${customer.first_name} ${customer.last_name}${address ? ` • ${address}` : ""}`
            : address || "Accepted Ironwood project"
        }
      />

      <div style={{ display:"flex", gap:"12px", marginBottom:"18px" }}>
        <Link href={`/time?project=${project.id}`} className="button button--gold">
          <Clock3 size={17}/>Track Time
        </Link>
      </div>

      <section className="project-overview-grid">
        <article className="panel"><span className="project-overview-label">Status</span><div className="project-overview-value"><StatusPill value={project.status}/></div></article>
        <article className="panel"><span className="project-overview-label">Contract</span><strong className="project-overview-number">{money(contractTotal)}</strong></article>
        <article className="panel"><span className="project-overview-label">Paid</span><strong className="project-overview-number">{money(amountPaid)}</strong></article>
        <article className="panel"><span className="project-overview-label">Remaining</span><strong className="project-overview-number">{money(remaining)}</strong></article>
      </section>

      <LaborVsActual laborItems={(laborItems ?? []) as any} timeEntries={(timeEntries ?? []) as any}/>

      {(estimate?.scope || estimate?.payment_schedule) && (
        <section className="panel project-detail-info">
          {estimate?.scope && <div><h2>Scope</h2><p className="pre-line">{estimate.scope}</p></div>}
          {estimate?.payment_schedule && <div><h2>Payment schedule</h2><p className="pre-line">{estimate.payment_schedule}</p></div>}
        </section>
      )}

      <ProjectMedia projectId={project.id} estimateId={estimateId} initialMedia={media}/>
    </div>
  );
}
