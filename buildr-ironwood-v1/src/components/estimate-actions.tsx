"use client";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EstimateActions({estimateId,estimateNumber,status,archived=false}:{estimateId:string;estimateNumber:string;status:string;archived?:boolean}) {
  const router=useRouter(); const supabase=createClient();
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  async function setArchive(value:string|null){
    setBusy(true); setError("");
    const {error:e}=await supabase.from("estimates").update({archived_at:value}).eq("id",estimateId);
    setBusy(false); if(e){setError(e.message);return;} router.refresh();
  }

  async function remove(){
    setError("");
    if(status==="accepted"){setError("Accepted estimates are protected. Archive this estimate instead.");return;}
    if(!window.confirm(`Permanently delete ${estimateNumber}? This cannot be undone.`)) return;
    if(window.prompt(`Type DELETE to permanently remove ${estimateNumber}.`)!=="DELETE"){setError("Permanent deletion was cancelled.");return;}
    setBusy(true);
    const {error:e}=await supabase.from("estimates").delete().eq("id",estimateId);
    setBusy(false); if(e){setError(e.message);return;} router.refresh();
  }

  return <div className="estimate-management-actions">
    <button type="button" className="button button--outline button--small" disabled={busy}
      onClick={()=>setArchive(archived?null:new Date().toISOString())}>
      {archived?<ArchiveRestore size={15}/>:<Archive size={15}/>}
      {archived?"Restore":"Archive"}
    </button>
    <button type="button" className="button button--danger button--small" disabled={busy||status==="accepted"} onClick={remove}>
      <Trash2 size={15}/>Delete
    </button>
    {error&&<small className="estimate-management-error">{error}</small>}
  </div>;
}
