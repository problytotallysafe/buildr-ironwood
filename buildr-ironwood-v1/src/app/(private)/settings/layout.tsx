import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav className="settings-nav panel" aria-label="Settings sections">
      <Link href="/settings">Business settings</Link>
      <Link href="/settings/team">Team & logins</Link>
    </nav>
    {children}
  </>;
}
