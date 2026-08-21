import { notFound } from "next/navigation";
import { IndependenceQuestionnaire } from "@/components/independence-questionnaire";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
export default async function EditIndependencePage({params}:{params:Promise<{id:string}>}){const {id}=await params;const supabase=await createClient();const [{data:a},{data:customers}]=await Promise.all([supabase.from("independence_assessments").select("*").eq("id",id).single(),supabase.from("customers").select("id,first_name,last_name,company_name").order("last_name")]);if(!a)notFound();return <div className="page-wrap"><PageHeader eyebrow="Ironwood Independence Collection" title="Edit in-home evaluation" description="Update any answer, selected base-package item, or Independence option."/><IndependenceQuestionnaire customers={customers??[]} initial={a as any}/></div>}
