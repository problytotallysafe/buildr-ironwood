import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export const BUSINESS_ROLES = [
  "owner",
  "admin",
  "estimator",
  "field",
  "read_only",
] as const;

export type BusinessRole = (typeof BUSINESS_ROLES)[number];
type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type BusinessAccess = {
  user: User;
  ownerId: string;
  role: BusinessRole;
  memberId: string | null;
  fullName: string | null;
};

function isBusinessRole(value: unknown): value is BusinessRole {
  return typeof value === "string" && BUSINESS_ROLES.includes(value as BusinessRole);
}

async function activeMembership(client: ServerClient, userId: string) {
  return client
    .from("business_members")
    .select("id,business_owner_id,role,full_name")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
}

export async function resolveBusinessAccess(
  client: ServerClient,
  user: User,
): Promise<BusinessAccess | null> {
  let { data: member } = await activeMembership(client, user.id);

  if (!member) {
    // Invites intentionally have no user_id until the recipient proves control
    // of the invited email address. This RPC binds and activates that invite.
    await client.rpc("accept_business_invitation");
    ({ data: member } = await activeMembership(client, user.id));
  }

  if (member && isBusinessRole(member.role)) {
    return {
      user,
      ownerId: member.business_owner_id,
      role: member.role,
      memberId: member.id,
      fullName: member.full_name,
    };
  }

  const { data: ownedWorkspace } = await client
    .from("business_settings")
    .select("owner_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!ownedWorkspace) return null;

  return {
    user,
    ownerId: user.id,
    role: "owner",
    memberId: null,
    fullName: null,
  };
}

export async function getBusinessAccess(
  client?: ServerClient,
): Promise<BusinessAccess | null> {
  const supabase = client ?? await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return resolveBusinessAccess(supabase, user);
}

export function canManageSettings(access: BusinessAccess) {
  return access.role === "owner" || access.role === "admin";
}

export function canManageTeam(access: BusinessAccess) {
  return access.role === "owner" || access.role === "admin";
}
