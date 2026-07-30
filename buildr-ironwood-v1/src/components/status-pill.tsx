export function StatusPill({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  return <span className={`status status--${value}`}>{label}</span>;
}
