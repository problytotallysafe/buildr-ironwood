type CostedTimeEntry = {
  team_member_id?: string | null;
  hourly_cost?: number | string | null;
};

export function effectiveHourlyCost(
  entry: CostedTimeEntry,
  ownerHourlyCost: number,
) {
  const storedCost = Number(entry.hourly_cost ?? 0);
  if (entry.team_member_id == null && storedCost <= 0 && ownerHourlyCost > 0) {
    return ownerHourlyCost;
  }
  return Math.max(0, storedCost);
}

export function ownerCostIsMissing(entry: CostedTimeEntry, ownerHourlyCost: number) {
  return entry.team_member_id == null
    && Number(entry.hourly_cost ?? 0) <= 0
    && ownerHourlyCost <= 0;
}
