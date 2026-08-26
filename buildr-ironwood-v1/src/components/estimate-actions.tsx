"use client";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EstimateActions({estimateId,estimateNumber,status,archived=false,deleted=false,redirectAfterDelete=false}:{estimateId:string;estimateNumber:string;status:string;archived?:boolean;deleted?:boolean;redirectAfterDelete?:boolean}) {
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
    if(!window.confirm(`Move ${estimateNumber} to Trash? You can restore it later.`)) return;
    setBusy(true);
    const {error:e}=await supabase.from("estimates").update({deleted_at:new Date().toISOString()}).eq("id",estimateId);
    setBusy(false); if(e){setError(e.message);return;}
    if(redirectAfterDelete) router.push("/estimates"); else router.refresh();
  }

  async function restore(){
    setError(""); setBusy(true);
    const {error:e}=await supabase.from("estimates").update({deleted_at:null,archived_at:null}).eq("id",estimateId);
    setBusy(false); if(e){setError(e.message);return;} router.refresh();
  }

  return <div className="estimate-management-actions">
    {!deleted && <button type="button" className="button button--outline button--small" disabled={busy}
      onClick={()=>setArchive(archived?null:new Date().toISOString())}>
      {archived?<ArchiveRestore size={15}/>:<Archive size={15}/>}
      {archived?"Restore":"Archive"}
    </button>}
    {deleted ? (
      <button type="button" className="button button--outline button--small" disabled={busy} onClick={restore}>
        <ArchiveRestore size={15}/>Restore
      </button>
    ) : (
      <button type="button" className="button button--danger button--small" disabled={busy||status==="accepted"} onClick={remove}>
        <Trash2 size={15}/>Move to Trash
      </button>
    )}
    {error&&<small className="estimate-management-error">{error}</small>}
  </div>;
}
