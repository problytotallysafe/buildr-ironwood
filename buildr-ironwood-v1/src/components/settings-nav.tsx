"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/settings", label: "Business" },
  { href: "/settings/time", label: "Time & GPS" },
  { href: "/settings/team", label: "Team access" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="settings-nav panel" aria-label="Settings sections">
      {sections.map((section) => {
        const active = section.href === "/settings"
          ? pathname === section.href
          : pathname === section.href || pathname.startsWith(`${section.href}/`);
        return <Link key={section.href} href={section.href} className={active ? "active" : ""}>{section.label}</Link>;
      })}
    </nav>
  );
}
