import { notFound } from "next/navigation";

import { EstimateBuilder } from "@/components/estimate-builder";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: estimate },
    { data: customers },
    { data: settings },
    { data: sections },
    { data: items },
  ] = await Promise.all([
    supabase.from("estimates").select("*").eq("id", id).single(),
    supabase
      .from("customers")
      .select("id,first_name,last_name,company_name")
      .order("last_name"),
    supabase
      .from("business_settings")
      .select("default_tax_rate,default_markup_rate")
      .maybeSingle(),
    supabase
      .from("estimate_sections")
      .select("*")
      .eq("estimate_id", id)
      .order("sort_order"),
    supabase
      .from("estimate_items")
      .select("*")
      .eq("estimate_id", id)
      .order("sort_order"),
  ]);

  if (!estimate) notFound();

  const sectionList = (sections ?? []).map((section) => ({
    ...section,
    items: (items ?? []).filter(
      (item) => String(item.section_id) === String(section.id),
    ),
  }));

  const orphanItems = (items ?? []).filter((item) => !item.section_id);

  if (orphanItems.length) {
    sectionList.unshift({
      id: `legacy-${id}`,
      owner_id: estimate.owner_id,
      estimate_id: id,
      title: "General",
      description: null,
      sort_order: -1,
      created_at: estimate.created_at,
      updated_at: estimate.updated_at,
      items: orphanItems,
    });
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={estimate.estimate_number ?? "Edit estimate"}
        title={`Edit ${estimate.title}`}
        description="Update the scope, pricing, sections, notes, and payment schedule without creating a duplicate estimate."
      />

      <EstimateBuilder
        customers={customers ?? []}
        defaults={{
          tax_rate: Number(settings?.default_tax_rate ?? 0),
          markup_rate: Number(settings?.default_markup_rate ?? 20),
        }}
        initialEstimate={{
          ...estimate,
          sections: sectionList,
        }}
      />
    </div>
  );
}
