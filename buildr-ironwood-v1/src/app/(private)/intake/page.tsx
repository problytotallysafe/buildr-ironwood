import Link from "next/link";
import { ClipboardList, FileText, Inbox, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const intakeOptions = [
  { href: "/leads", title: "Start with a lead", copy: "Review new inquiries and turn a qualified lead into a customer.", icon: Inbox },
  { href: "/customers/new", title: "Add a new customer", copy: "Create the customer record first so every next step stays connected.", icon: UserPlus },
  { href: "/site-visits", title: "Site visits", copy: "Start a new visit or continue a worksheet with goals, measurements, conditions, and photos.", icon: ClipboardList },
  { href: "/estimates/new", title: "Start an estimate", copy: "Use the guided setup and build a detailed proposal.", icon: FileText },
  { href: "/independence", title: "Independence reviews", copy: "Start or continue an in-home comfort, safety, and accessibility review.", icon: ShieldCheck },
  { href: "/customers", title: "Continue with a customer", copy: "Open an existing customer and choose their next step.", icon: Users },
];

export default function IntakePage() {
  return <div className="page-wrap">
    <PageHeader eyebrow="Connected workflow" title="New Client Intake" description="Start wherever the conversation begins. Buildr keeps the customer, visit, estimate, and project connected as the work moves forward."/>
    <section className="intake-flow" aria-label="Client workflow"><span>Lead</span><b>→</b><span>Customer</span><b>→</b><span>Site visit</span><b>→</b><span>Estimate</span><b>→</b><span>Project</span></section>
    <section className="intake-grid">{intakeOptions.map(({href,title,copy,icon:Icon})=><Link className="panel intake-card" href={href} key={href}><Icon/><div><h2>{title}</h2><p>{copy}</p></div></Link>)}</section>
  </div>;
}
