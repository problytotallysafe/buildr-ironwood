export function IronwoodLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup brand-lockup--buildr ${compact ? "brand-lockup--compact" : ""}`}>
      <img src="/buildr-logo.jpg" alt="Buildr Remodeling App" />
    </div>
  );
}
