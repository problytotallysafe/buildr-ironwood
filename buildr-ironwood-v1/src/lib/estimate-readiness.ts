export type SavedEstimateForReadiness = {
  title?: string | null;
  project_address?: string | null;
  scope?: string | null;
  exclusions?: string | null;
  payment_schedule?: string | null;
};

export type SavedEstimateItemForReadiness = {
  description?: string | null;
  unit_cost?: number | string | null;
  quantity?: number | string | null;
};

export function getEstimateSendWarnings(
  estimate: SavedEstimateForReadiness,
  items: SavedEstimateItemForReadiness[],
) {
  const warnings: string[] = [];

  if (!estimate.title?.trim()) warnings.push("Project title is missing");
  if (!estimate.project_address?.trim()) warnings.push("Jobsite address is missing");
  if (!estimate.scope?.trim()) warnings.push("Detailed scope of work is incomplete");
  if (!estimate.exclusions?.trim()) warnings.push("Exclusions and owner-supplied items are not confirmed");
  if (!estimate.payment_schedule?.trim()) warnings.push("Payment schedule is incomplete");
  if (!items.length) warnings.push("No priced line items were added");
  if (items.some((item) => !item.description?.trim())) warnings.push("One or more line items are missing a description");
  if (items.some((item) => Number(item.unit_cost ?? 0) === 0)) warnings.push("One or more line items have a $0 cost");
  if (items.some((item) => Number(item.quantity ?? 0) <= 0)) warnings.push("One or more line items have no quantity");

  return warnings;
}

export function confirmEstimateSend(warnings: string[]) {
  if (!warnings.length) return true;

  return window.confirm(
    [
      "Buildr's second set of eyes found a few details that may need attention:",
      "",
      ...warnings.map((warning) => "• " + warning),
      "",
      "Did you mean to leave these incomplete?",
      "",
      "Press OK to send anyway, or Cancel to go back and fix them.",
    ].join("\n"),
  );
}
