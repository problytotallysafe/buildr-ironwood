"use client";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmEstimateSend } from "@/lib/estimate-readiness";
export function SendEstimateButton({ id, disabled, warnings=[] }: { id:string; disabled?:boolean; warnings?:string[] }) {
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
 async function send(){if(!confirmEstimateSend(warnings))return;setBusy(true);setMessage("");const response=await fetch(`/api/estimates/${id}/send`,{method:"POST"});const body=await response.json().catch(()=>({}));setBusy(false);setMessage(response.ok?"Proposal emailed.":body.error||"Could not send proposal.");if(response.ok)router.refresh();}
 return <div className="send-control"><button className="button button--gold" onClick={send} disabled={busy||disabled}><Send size={16}/>{busy?"Sending…":"Send proposal"}</button>{message&&<small>{message}</small>}</div>;
}
