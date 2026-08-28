"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck2,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  LineChart,
  Inbox,
  LogOut,
  Menu,
  Bell,
  Settings,
  Square,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GpsClockInAgent, type GpsProject } from "./gps-clock-in";
import { IronwoodLogo } from "./ironwood-logo";

const nav: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "leads" | "notifications";
}> = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { href: "/today", label: "Project Today", icon: CalendarCheck2 },
  { href: "/intake", label: "New Client Intake", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/leads", label: "Leads", icon: Inbox, badge: "leads" },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/projects", label: "Projects", icon: BriefcaseBusiness },
  { href: "/time", label: "Time Tracker", icon: Clock3 },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/catalog", label: "Price Book", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

type ActiveTime = {
  id: string;
  project_id: string;
  started_at: string;
  projects: {
    name: string | null;
    estimates: { title: string | null } | null;
  } | null;
} | null;

function elapsedText(startedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export function AppShell({
  children,
  email,
  userId,
  activeTime,
  newLeadCount,
  unreadNotificationCount,
  gpsProjects,
}: {
  children: React.ReactNode;
  email?: string;
  userId: string;
  activeTime: ActiveTime;
  newLeadCount: number;
  unreadNotificationCount: number;
  gpsProjects: GpsProject[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [clockBusy, setClockBusy] = useState(false);
  const [badges, setBadges] = useState({
    leads: newLeadCount,
    notifications: unreadNotificationCount,
  });

  useEffect(() => {
    let cancelled = false;
    async function refreshBadges() {
      const supabase = createClient();
      const [{ count: leads }, { count: notifications }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new").is("archived_at", null).is("deleted_at", null),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      if (!cancelled) setBadges({ leads: leads ?? 0, notifications: notifications ?? 0 });
    }
    void refreshBadges();
    const timer = window.setInterval(refreshBadges, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshBadges(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!activeTime) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [activeTime]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function clockOut() {
    if (!activeTime || clockBusy) return;
    setClockBusy(true);
    try {
      const endedAt = new Date();
      const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - new Date(activeTime.started_at).getTime()) / 60000));
      const { error } = await createClient()
        .from("time_entries")
        .update({
          ended_at: endedAt.toISOString(),
          duration_minutes: durationMinutes,
          updated_at: endedAt.toISOString(),
        })
        .eq("id", activeTime.id)
        .eq("owner_id", userId);
      if (error) throw error;
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not clock out.");
    } finally {
      setClockBusy(false);
    }
  }

  const activeProjectName = activeTime?.projects?.estimates?.title || activeTime?.projects?.name || "Active project";

  return (
    <div className="app-frame">
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu size={22} />
      </button>

      {open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}

      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <IronwoodLogo />
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
        </div>

        <nav className="side-nav">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badgeCount = item.badge === "leads" ? badges.leads : item.badge === "notifications" ? badges.notifications : 0;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={active ? "active" : ""}>
                <Icon size={19} />
                <span>{item.label}</span>
                {badgeCount > 0 && <b className="nav-badge" aria-label={`${badgeCount} new`}>{badgeCount > 99 ? "99+" : badgeCount}</b>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <small>{email}</small>
          <button onClick={signOut}><LogOut size={17} />Sign out</button>
        </div>
      </aside>

      <main className="app-main">
        <GpsClockInAgent userId={userId} projects={gpsProjects} hasActiveTime={Boolean(activeTime)} />
        {activeTime && (
          <div
            style={{
              margin: "0 0 16px",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(193,154,64,.45)",
              background: "rgba(193,154,64,.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href={`/time?project=${activeTime.project_id}`} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, textDecoration: "none", color: "inherit" }}>
              <Clock3 size={18} />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeProjectName}</strong>
                <small>Clocked in · {elapsedText(activeTime.started_at, now)}</small>
              </span>
            </Link>
            <button className="button button--gold" type="button" onClick={clockOut} disabled={clockBusy} style={{ minHeight: 38 }}>
              <Square size={15} /> {clockBusy ? "Clocking out…" : "Clock Out"}
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
