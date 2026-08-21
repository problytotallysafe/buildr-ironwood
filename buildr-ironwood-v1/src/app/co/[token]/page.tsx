import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicChangeOrder } from "@/components/public-change-order";
export const dynamic="force-dynamic";
export default async function ChangeOrderApprovalPage({params}:{params:Promise<{token:string}>}){const {token}=await params;const supabase=await createClient();const {data,error}=await supabase.rpc("get_public_change_order",{p_token:token});if(error||!data)notFound();return <PublicChangeOrder token={token} document={data}/>}
