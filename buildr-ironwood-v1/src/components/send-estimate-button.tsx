"use client";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SendEstimateButton({ id, disabled }: { id:string; disabled?:boolean }) {
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
 async function send(){setBusy(true);setMessage("");const response=await fetch(`/api/estimates/${id}/send`,{method:"POST"});const body=await response.json().catch(()=>({}));setBusy(false);setMessage(response.ok?"Proposal emailed.":body.error||"Could not send proposal.");if(response.ok)router.refresh();}
 return <div className="send-control"><button className="button button--gold" onClick={send} disabled={busy||disabled}><Send size={16}/>{busy?"Sending…":"Send proposal"}</button>{message&&<small>{message}</small>}</div>;
}
