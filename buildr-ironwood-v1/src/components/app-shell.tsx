"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Clock3,
  CreditCard,
  FileText,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { IronwoodLogo } from "./ironwood-logo";

const nav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
  },
  {
    href: "/estimates",
    label: "Estimates",
    icon: FileText,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: BriefcaseBusiness,
  },
  {
    href: "/time",
    label: "Time Tracker",
    icon: Clock3,
  },
  {
    href: "/payments",
    label: "Payments",
    icon: CreditCard,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: LineChart,
  },
  {
    href: "/catalog",
    label: "Price Book",
    icon: BookOpen,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] =
    useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-frame">
      <button
        className="mobile-menu"
        onClick={() =>
          setOpen(true)
        }
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>

      {open && (
        <button
          className="nav-scrim"
          onClick={() =>
            setOpen(false)
          }
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`sidebar ${
          open
            ? "sidebar--open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <IronwoodLogo />

          <button
            className="sidebar-close"
            onClick={() =>
              setOpen(false)
            }
            aria-label="Close navigation"
          >
            <X />
          </button>

          <div className="product-name">
            BUILDR
          </div>

          <div className="product-tagline">
            Estimate. Build. Get paid.
          </div>
        </div>

        <nav className="side-nav">
          {nav.map((item) => {
            const active =
              pathname ===
                item.href ||
              pathname.startsWith(
                `${item.href}/`,
              );

            const Icon =
              item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() =>
                  setOpen(false)
                }
                className={
                  active
                    ? "active"
                    : ""
                }
              >
                <Icon
                  size={19}
                />

                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <small>
            {email}
          </small>

          <button
            onClick={signOut}
          >
            <LogOut
              size={17}
            />

            Sign out
          </button>
        </div>
      </aside>

      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
