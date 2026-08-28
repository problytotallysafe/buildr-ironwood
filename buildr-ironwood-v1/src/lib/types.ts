export type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
export type { ProjectStatus } from "@/lib/projects";

export type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
};

export type Estimate = {
  id: string;
  estimate_number: string;
  title: string;
  status: EstimateStatus;
  customer_id: string;
  project_address: string | null;
  scope: string | null;
  exclusions: string | null;
  customer_notes: string | null;
  private_notes: string | null;
  payment_schedule: string | null;
  tax_rate: number;
  default_markup_rate: number;
  subtotal: number;
  markup_total: number;
  tax_total: number;
  total: number;
  public_token: string;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  accepted_by_name: string | null;
  created_at: string;
};

export type EstimateItemDraft = {
  id?: string;
  item_type: "labor" | "material" | "subcontractor" | "allowance" | "fee" | "other";
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  markup_rate: number;
  taxable: boolean;
  vendor: string;
  vendor_sku: string;
  vendor_url: string;
  private_notes: string;
  selection_status: "final" | "allowance" | "customer_supplied" | "undecided" | "excluded";
  selection_responsibility: "ironwood" | "customer";
  selection_deadline: string;
  selected_product: string;
  selection_notes: string;
};
