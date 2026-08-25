import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activeTime } = await supabase
    .from("time_entries")
    .select("id,project_id,started_at,projects(name,estimates(title))")
    .eq("owner_id", user.id)
    .is("team_member_id", null)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell
      email={user.email}
      userId={user.id}
      activeTime={(activeTime ?? null) as any}
    >
      {children}
    </AppShell>
  );
}
