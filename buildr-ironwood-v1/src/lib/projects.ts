export const ACTIVE_PROJECT_STATUSES = [
  "scheduled",
  "in_progress",
  "waiting",
  "on_hold",
  "substantially_complete",
] as const;

export const PROJECT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "on_hold", label: "On hold" },
  { value: "substantially_complete", label: "Substantially complete" },
  { value: "complete", label: "Complete" },
] as const;

export const PROJECT_STATUS_VALUES = PROJECT_STATUS_OPTIONS.map(
  ({ value }) => value,
);

export type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

export function isProjectStatus(status: string): status is ProjectStatus {
  return PROJECT_STATUS_VALUES.includes(status as ProjectStatus);
}

export function isActiveProjectStatus(status: string | null | undefined) {
  return ACTIVE_PROJECT_STATUSES.includes(
    status as (typeof ACTIVE_PROJECT_STATUSES)[number],
  );
}
