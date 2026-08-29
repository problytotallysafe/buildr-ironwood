import { SettingsNav } from "@/components/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>
    <SettingsNav />
    {children}
  </>;
}
