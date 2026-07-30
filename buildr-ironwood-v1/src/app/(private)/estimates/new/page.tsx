import { PageHeader } from "@/components/page-header";
import { EstimateBuilder } from "@/components/estimate-builder";
import { createClient } from "@/lib/supabase/server";

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{customer?:string}> }) {
  const query=await searchParams; const supabase=await createClient();
  const [{data:customers},{data:settings}]=await Promise.all([supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name"),supabase.from("business_settings").select("default_tax_rate,default_markup_rate").maybeSingle()]);
  return <div className="page-wrap"><PageHeader eyebrow="Estimate builder" title="Write a detailed bid" description="Price the job your way, keep internal notes private, and turn it into a clean customer proposal."/><EstimateBuilder customers={customers??[]} selectedCustomer={query.customer} defaults={{tax_rate:Number(settings?.default_tax_rate??0),markup_rate:Number(settings?.default_markup_rate??20)}}/></div>;
}
