import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicProposal } from "@/components/public-proposal";

export const dynamic="force-dynamic";
export default async function ProposalPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{via?:string}>}){const [{token},query]=await Promise.all([params,searchParams]);const supabase=await createClient();const {data,error}=await supabase.rpc("get_public_estimate",{p_token:token});if(error||!data)notFound();return <PublicProposal token={token} proposal={data} via={query.via}/>;}
