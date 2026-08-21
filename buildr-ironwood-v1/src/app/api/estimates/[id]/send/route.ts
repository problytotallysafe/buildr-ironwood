import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: estimate, error } = await supabase.from("estimates").select("id,estimate_number,revision_number,title,total,public_token,customers(first_name,last_name,email)").eq("id",id).single();
    if(error||!estimate) return NextResponse.json({error:"Estimate not found."},{status:404});
    const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
    if(!customer?.email) return NextResponse.json({error:"Add a customer email before sending."},{status:400});
    if(!process.env.RESEND_API_KEY||!process.env.PROPOSAL_FROM_EMAIL) return NextResponse.json({error:"Email is not configured. Add RESEND_API_KEY and PROPOSAL_FROM_EMAIL."},{status:500});
    const appUrl=process.env.NEXT_PUBLIC_APP_URL||new URL(_.url).origin; const proposalUrl=`${appUrl}/p/${estimate.public_token}`;
    const resend=new Resend(process.env.RESEND_API_KEY); const result=await resend.emails.send({from:process.env.PROPOSAL_FROM_EMAIL,to:customer.email,subject:`Ironwood proposal ${estimate.estimate_number}: ${estimate.title}`,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#202722"><div style="background:#183d32;padding:28px;color:white"><div style="color:#c59a52;font-size:12px;letter-spacing:2px">IRONWOOD HOME REMODELING</div><h1 style="margin:8px 0">Your project proposal is ready.</h1></div><div style="padding:28px;border:1px solid #ded8cc"><p>Hello ${customer.first_name},</p><p>Your detailed proposal for <strong>${estimate.title}</strong> is ready to review.</p><p style="font-size:26px;color:#183d32"><strong>${money(estimate.total)}</strong></p><p><a href="${proposalUrl}" style="display:inline-block;background:#c59a52;color:#172b24;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">Review and accept proposal</a></p><p>You can review the scope, pricing, payment schedule, and acceptance terms from the secure proposal page.</p><p>Thank you,<br><strong>Ironwood Remodeling</strong><br>479.496.7819</p></div></div>`},{headers:{"Idempotency-Key":`estimate-${id}-${Date.now()}`}} as any);
    if(result.error) return NextResponse.json({error:result.error.message},{status:500});
    const now=new Date().toISOString(); await supabase.from("estimates").update({status:"sent",sent_at:now}).eq("id",id); await supabase.from("estimate_events").insert({owner_id:user.id,estimate_id:id,event_type:"sent",metadata:{email:customer.email,resend_id:result.data?.id}});
    return NextResponse.json({ok:true});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not send."},{status:500});}
}
