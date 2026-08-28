export const leadCategories = [
  ["uncategorized", "Uncategorized"],
  ["bathroom", "Bathroom"],
  ["kitchen", "Kitchen"],
  ["whole-home", "Whole home"],
  ["addition", "Addition"],
  ["accessibility", "Accessibility"],
  ["doors-windows", "Doors & windows"],
  ["flooring-paint", "Flooring & paint"],
  ["repair-small-job", "Repair / small job"],
  ["other", "Other"],
] as const;

export const leadPriorities = [
  ["low", "Low"],
  ["normal", "Normal"],
  ["high", "High"],
  ["urgent", "Urgent"],
] as const;

export const leadStatuses = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["converted", "Converted"],
  ["closed", "Closed"],
] as const;

export function optionLabel(
  options: readonly (readonly [string, string])[],
  value: string | null | undefined,
) {
  return options.find(([key]) => key === value)?.[1] ?? value ?? "—";
}
