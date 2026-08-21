"use client";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SendChangeOrderButton({id,disabled}:{id:string;disabled?:boolean}){const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const router=useRouter();async function send(){setBusy(true);setMessage("");const response=await fetch(`/api/change-orders/${id}/send`,{method:"POST"});const body=await response.json().catch(()=>({}));setBusy(false);setMessage(response.ok?"Change order emailed.":body.error||"Could not send change order.");if(response.ok)router.refresh();}return <div className="send-control"><button className="button button--gold" type="button" onClick={send} disabled={busy||disabled}><Send size={16}/>{busy?"Sending…":"Send for approval"}</button>{message&&<small>{message}</small>}</div>}
