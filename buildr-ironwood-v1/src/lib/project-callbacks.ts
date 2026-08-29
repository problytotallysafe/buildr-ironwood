export const CALLBACK_STATUSES = ["draft", "accepted", "completed"] as const;
export const CALLBACK_WARRANTY_STATUSES = ["under_review", "warranty", "not_warranty"] as const;
export const CALLBACK_COST_RESPONSIBILITIES = ["undetermined", "ironwood", "homeowner", "shared"] as const;

export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];
export type CallbackWarrantyStatus = (typeof CALLBACK_WARRANTY_STATUSES)[number];
export type CallbackCostResponsibility = (typeof CALLBACK_COST_RESPONSIBILITIES)[number];
export type CallbackView = "active" | "archived" | "trash" | "all";

export const callbackStatusOptions: Array<[CallbackStatus, string]> = [
  ["draft", "Logged — under review"],
  ["accepted", "Accepted — repair planned"],
  ["completed", "Completed — repair finished"],
];

export const callbackWarrantyOptions: Array<[CallbackWarrantyStatus, string]> = [
  ["under_review", "Under review"],
  ["warranty", "Warranty callback"],
  ["not_warranty", "Not warranty"],
];

export const callbackResponsibilityOptions: Array<[CallbackCostResponsibility, string]> = [
  ["undetermined", "Not decided yet"],
  ["ironwood", "Ironwood pays"],
  ["homeowner", "Homeowner pays"],
  ["shared", "Cost is shared"],
];

export function isCallbackStatus(value: unknown): value is CallbackStatus {
  return typeof value === "string" && CALLBACK_STATUSES.includes(value as CallbackStatus);
}

export function isCallbackWarrantyStatus(value: unknown): value is CallbackWarrantyStatus {
  return typeof value === "string" && CALLBACK_WARRANTY_STATUSES.includes(value as CallbackWarrantyStatus);
}

export function isCallbackCostResponsibility(value: unknown): value is CallbackCostResponsibility {
  return typeof value === "string" && CALLBACK_COST_RESPONSIBILITIES.includes(value as CallbackCostResponsibility);
}

export function safeCallbackView(value?: string): CallbackView {
  return ["active", "archived", "trash", "all"].includes(value ?? "")
    ? value as CallbackView
    : "active";
}

export function callbackOptionLabel<T extends string>(options: Array<[T, string]>, value: unknown) {
  return options.find(([key]) => key === value)?.[1] ?? String(value || "Not entered").replaceAll("_", " ");
}

export type CallbackFinancialRow = {
  status: string;
  estimated_internal_cost: number | string | null;
  actual_internal_cost: number | string | null;
  homeowner_amount: number | string | null;
  deleted_at?: string | null;
};

export function callbackInternalCost(row: CallbackFinancialRow) {
  return Number(row.actual_internal_cost ?? row.estimated_internal_cost ?? 0);
}

export function callbackAffectsFinancials(row: CallbackFinancialRow) {
  return !row.deleted_at && (row.status === "accepted" || row.status === "completed");
}

export function callbackReadyForAcceptance(row: {
  warranty_status: string;
  cost_responsibility: string;
  repair_plan: string | null;
}) {
  return row.warranty_status !== "under_review"
    && row.cost_responsibility !== "undetermined"
    && Boolean(row.repair_plan?.trim());
}

export function summarizeCallbackFinancials(rows: CallbackFinancialRow[]) {
  return rows.reduce((summary, row) => {
    if (!callbackAffectsFinancials(row)) return summary;
    summary.revenue += Number(row.homeowner_amount ?? 0);
    summary.cost += callbackInternalCost(row);
    summary.net = summary.revenue - summary.cost;
    return summary;
  }, { revenue: 0, cost: 0, net: 0 });
}

function textFormValue(formData: FormData, name: string, maximum = 10000) {
  return String(formData.get(name) || "").trim().slice(0, maximum) || null;
}

function dateFormValue(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function moneyFormValue(formData: FormData, name: string, nullable = false) {
  const raw = String(formData.get(name) || "").trim();
  if (!raw) return nullable ? null : 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) return nullable ? null : 0;
  return Math.min(99_999_999.99, Math.max(0, Math.round(value * 100) / 100));
}

export function callbackFormValues(formData: FormData) {
  const title = textFormValue(formData, "title", 160);
  const issueDescription = textFormValue(formData, "issue_description");
  const reportedAt = dateFormValue(formData, "reported_at");
  const warrantyStatus = String(formData.get("warranty_status") || "");
  const costResponsibility = String(formData.get("cost_responsibility") || "");

  if (!title || !issueDescription || !reportedAt) return null;
  if (!isCallbackWarrantyStatus(warrantyStatus) || !isCallbackCostResponsibility(costResponsibility)) return null;

  return {
    title,
    reported_at: reportedAt,
    scheduled_for: dateFormValue(formData, "scheduled_for"),
    issue_description: issueDescription,
    warranty_status: warrantyStatus,
    repair_plan: textFormValue(formData, "repair_plan"),
    cost_responsibility: costResponsibility,
    estimated_internal_cost: moneyFormValue(formData, "estimated_internal_cost"),
    actual_internal_cost: moneyFormValue(formData, "actual_internal_cost", true),
    homeowner_amount: moneyFormValue(formData, "homeowner_amount"),
    accepted_by_name: textFormValue(formData, "accepted_by_name", 200),
    acceptance_note: textFormValue(formData, "acceptance_note", 1000),
    private_notes: textFormValue(formData, "private_notes"),
  };
}
