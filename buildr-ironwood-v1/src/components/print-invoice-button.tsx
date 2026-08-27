"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return <button type="button" className="button button--gold no-print" onClick={() => window.print()}><Printer size={16}/>Print or save PDF</button>;
}
