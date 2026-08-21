"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id:string; first_name:string; last_name:string; company_name:string|null };
type Assessment = {
  id:string; customer_id:string; evaluation_date:string; title:string; home_areas:string[];
  priorities:string[]; current_conditions:Record<string,string>; base_package_items:string[];
  independence_options:string[]; measurements:string|null; observations:string|null;
  customer_goals:string|null; private_notes:string|null;
};

const areas=["Primary bathroom","Hall bathroom","Kitchen","Entry / exterior","Hallways / stairs","Whole home"];
const priorities=["Safer shower access","Steadier movement","Easier toilet use","Better lighting","Easier storage access","Simpler daily routines","Plan for long-term independence"];
const baseItems=["Remove existing tub and protect the work area","Install a low-threshold shower pan","Install an acrylic or composite wall system","Install proper blocking and two decorative grab bars","Install a handheld shower","Install LVP flooring","Complete trim and paint touch-ups","Final cleanup and independence walkthrough"];
const options=["Comfort-height toilet","Vanity and top","Improved LED lighting","Ventilation fan","Glass shower door","Additional storage","Additional decorative grab bars","Doorway / threshold improvements","Kitchen access improvements"];

function toggle(list:string[],value:string){return list.includes(value)?list.filter((item)=>item!==value):[...list,value];}

export function IndependenceQuestionnaire({customers,initial,selectedCustomer}:{customers:Customer[];initial?:Assessment;selectedCustomer?:string}){
  const router=useRouter(); const supabase=createClient(); const editing=Boolean(initial);
  const [customerId,setCustomerId]=useState(initial?.customer_id??selectedCustomer??"");
  const [date,setDate]=useState(initial?.evaluation_date??new Date().toISOString().slice(0,10));
  const [title,setTitle]=useState(initial?.title??"Ironwood Independence In-Home Evaluation");
  const [homeAreas,setHomeAreas]=useState<string[]>(initial?.home_areas??["Primary bathroom"]);
  const [selectedPriorities,setSelectedPriorities]=useState<string[]>(initial?.priorities??[]);
  const [conditions,setConditions]=useState<Record<string,string>>(initial?.current_conditions??{});
  const [selectedBase,setSelectedBase]=useState<string[]>(initial?.base_package_items??baseItems);
  const [selectedOptions,setSelectedOptions]=useState<string[]>(initial?.independence_options??[]);
  const [goals,setGoals]=useState(initial?.customer_goals??""); const [measurements,setMeasurements]=useState(initial?.measurements??"");
  const [observations,setObservations]=useState(initial?.observations??""); const [privateNotes,setPrivateNotes]=useState(initial?.private_notes??"");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  async function save(event:FormEvent){event.preventDefault();setError("");if(!customerId){setError("Choose a customer.");return;}setBusy(true);
    try{const {data:{user}}=await supabase.auth.getUser();if(!user){setError("Your session expired. Sign in again.");return;}
      const values={customer_id:customerId,evaluation_date:date,title:title.trim(),home_areas:homeAreas,priorities:selectedPriorities,current_conditions:conditions,base_package_items:selectedBase,independence_options:selectedOptions,customer_goals:goals.trim()||null,measurements:measurements.trim()||null,observations:observations.trim()||null,private_notes:privateNotes.trim()||null};
      if(initial){const {error:e}=await supabase.from("independence_assessments").update(values).eq("id",initial.id);if(e){setError(e.message);return;}router.push(`/independence/${initial.id}`);}
      else{const {data,error:e}=await supabase.from("independence_assessments").insert({owner_id:user.id,...values}).select("id").single();if(e||!data){setError(e?.message||"Could not save the evaluation.");return;}router.push(`/independence/${data.id}`);}router.refresh();
    }finally{setBusy(false);}}

  const conditionFields=[
    ["bathing","Current tub / shower"],["entry","Shower entry height / access"],["grab_bars","Existing grab bars / support"],
    ["flooring","Flooring condition / traction"],["toilet","Toilet height / access"],["lighting","Lighting / visibility"],
    ["ventilation","Ventilation"],["doorway","Doorway / threshold access"],["storage","Storage reach / access"],
  ];

  return <form className="stack" onSubmit={save}>
    <section className="panel form-grid"><label className="span-2">Customer<select value={customerId} onChange={e=>setCustomerId(e.target.value)} required><option value="">Choose a customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.company_name?` — ${c.company_name}`:""}</option>)}</select></label><label>Evaluation date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Evaluation title<input value={title} onChange={e=>setTitle(e.target.value)}/></label></section>
    <section className="panel"><h2>Where should we focus?</h2><p className="muted">Choose every area that should be part of the conversation.</p><div className="check-grid">{areas.map(item=><label className="choice-check" key={item}><input type="checkbox" checked={homeAreas.includes(item)} onChange={()=>setHomeAreas(toggle(homeAreas,item))}/><span><Check size={15}/>{item}</span></label>)}</div></section>
    <section className="panel"><h2>Comfort, safety & independence priorities</h2><div className="check-grid">{priorities.map(item=><label className="choice-check" key={item}><input type="checkbox" checked={selectedPriorities.includes(item)} onChange={()=>setSelectedPriorities(toggle(selectedPriorities,item))}/><span><Check size={15}/>{item}</span></label>)}</div><label className="block-label">What would make daily life easier?<textarea rows={4} value={goals} onChange={e=>setGoals(e.target.value)} placeholder="Use the customer's own words when possible."/></label></section>
    <section className="panel"><h2>Current home conditions</h2><div className="form-grid">{conditionFields.map(([key,label])=><label key={key}>{label}<input value={conditions[key]??""} onChange={e=>setConditions({...conditions,[key]:e.target.value})} placeholder="Condition, concern, or measurement"/></label>)}</div><label className="block-label">Measurements<textarea rows={4} value={measurements} onChange={e=>setMeasurements(e.target.value)}/></label><label className="block-label">Evaluation observations<textarea rows={5} value={observations} onChange={e=>setObservations(e.target.value)} placeholder="Document barriers, concealed-condition concerns, and opportunities. Photos stay with the project record."/></label></section>
    <section className="panel"><h2>Independence Collection base package</h2><p className="muted">Select the standard work that fits this home. Everything remains editable before the proposal is sent.</p><div className="check-list">{baseItems.map(item=><label className="choice-check" key={item}><input type="checkbox" checked={selectedBase.includes(item)} onChange={()=>setSelectedBase(toggle(selectedBase,item))}/><span><Check size={15}/>{item}</span></label>)}</div></section>
    <section className="panel"><h2>Independence options</h2><p className="muted">These are separately priced options—not pressure-based “upgrades.”</p><div className="check-grid">{options.map(item=><label className="choice-check" key={item}><input type="checkbox" checked={selectedOptions.includes(item)} onChange={()=>setSelectedOptions(toggle(selectedOptions,item))}/><span><Check size={15}/>{item}</span></label>)}</div><label className="block-label">Private Ironwood notes<textarea rows={4} value={privateNotes} onChange={e=>setPrivateNotes(e.target.value)}/></label></section>
    {error&&<p className="error-box">{error}</p>}<div className="form-actions"><button className="button button--gold" disabled={busy}><Save size={17}/>{busy?"Saving…":editing?"Save evaluation changes":"Save evaluation"}</button></div>
  </form>;
}
