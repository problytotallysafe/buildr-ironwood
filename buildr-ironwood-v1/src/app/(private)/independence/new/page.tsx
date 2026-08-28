import { IndependenceQuestionnaire } from "@/components/independence-questionnaire";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
export default async function NewIndependencePage({searchParams}:{searchParams:Promise<{customer?:string}>}){const query=await searchParams;const supabase=await createClient();const {data:customers}=await supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name");return <div className="page-wrap"><PageHeader eyebrow="Ironwood Independence Collection" title="Independence In-Home Evaluation"/><IndependenceQuestionnaire customers={customers??[]} selectedCustomer={query.customer}/></div>}
