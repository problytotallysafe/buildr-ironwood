import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicProposal } from "@/components/public-proposal";

export const dynamic="force-dynamic";
export default async function ProposalPage({params}:{params:Promise<{token:string}>}){const {token}=await params;const supabase=await createClient();const {data,error}=await supabase.rpc("get_public_estimate",{p_token:token});if(error||!data)notFound();return <PublicProposal token={token} proposal={data}/>;}
