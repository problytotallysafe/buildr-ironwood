import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import {
  type BusinessRole,
  canManageTeam,
  getBusinessAccess,
} from "@/lib/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const assignableRoles: Array<{ value: Exclude<BusinessRole, "owner">; label: string }> = [
  { value: "field", label: "Field employee" },
  { value: "estimator", label: "Estimator" },
  { value: "admin", label: "Administrator" },
  { value: "read_only", label: "View only / demo" },
];

const roleLabels: Record<BusinessRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  estimator: "Estimator",
  field: "Field employee",
  read_only: "View only",
};

function validRole(value: string): value is Exclude<BusinessRole, "owner"> {
  return assignableRoles.some((role) => role.value === value);
}

function teamResult(value: string): never {
  redirect(`/settings/team?result=${encodeURIComponent(value)}`);
}

async function inviteMember(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");
  if (!canManageTeam(access)) teamResult("permission");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim() || null;
  const role = String(formData.get("role") || "field");
  if (!email || !email.includes("@") || !validRole(role)) teamResult("invalid");

  const admin = createAdminClient();
  const { data: existingMember } = await admin
    .from("business_members")
    .select("id")
    .eq("business_owner_id", access.ownerId)
    .ilike("email", email)
    .maybeSingle();
  if (existingMember) teamResult("duplicate");

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) teamResult("invite_error");

  const existingUser = users.users.find(
    (candidate) => candidate.email?.trim().toLowerCase() === email,
  );
  const now = new Date().toISOString();

  if (existingUser) {
    const { error } = await admin.from("business_members").insert({
      business_owner_id: access.ownerId,
      user_id: existingUser.id,
      email,
      full_name: fullName,
      role,
      status: "active",
      invited_by: access.user.id,
      accepted_at: now,
      last_access_at: null,
    });
    if (error) teamResult("invite_error");
    revalidatePath("/settings/team");
    teamResult("existing_granted");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: appUrl ? `${appUrl}/auth/confirm?next=/update-password` : undefined,
    data: { business_owner_id: access.ownerId },
  });
  if (inviteError) teamResult("invite_error");

  // user_id stays null until the invite recipient proves control of this email.
  const { error: memberError } = await admin.from("business_members").insert({
    business_owner_id: access.ownerId,
    user_id: null,
    email,
    full_name: fullName,
    role,
    status: "invited",
    invited_by: access.user.id,
  });
  if (memberError) teamResult("invite_error");

  revalidatePath("/settings/team");
  teamResult("invited");
}

async function updateMember(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");
  if (!canManageTeam(access)) teamResult("permission");

  const memberId = String(formData.get("member_id") || "");
  const action = String(formData.get("member_action") || "");
  if (!memberId) teamResult("invalid");

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("business_members")
    .select("id,user_id,role,status")
    .eq("id", memberId)
    .eq("business_owner_id", access.ownerId)
    .maybeSingle();
  if (!member || member.role === "owner") teamResult("invalid");

  let changes: Record<string, string> | null = null;
  if (action === "role") {
    const role = String(formData.get("role") || "");
    if (!validRole(role)) teamResult("invalid");
    changes = { role };
  } else if (action === "toggle") {
    changes = {
      status: member.status === "suspended"
        ? member.user_id ? "active" : "invited"
        : "suspended",
    };
  }
  if (!changes) teamResult("invalid");

  const { error } = await admin
    .from("business_members")
    .update(changes)
    .eq("id", member.id)
    .eq("business_owner_id", access.ownerId);
  if (error) teamResult("update_error");
  revalidatePath("/settings/team");
  teamResult("updated");
}

const resultMessages: Record<string, string> = {
  invited: "Secure invitation sent.",
  existing_granted: "That email already had a Buildr login. Access is now active; they can use Set or reset password on the login page.",
  updated: "Access updated.",
  duplicate: "That email is already listed below.",
  permission: "This access level cannot manage team logins.",
  invalid: "Check the account details and try again.",
  invite_error: "The invitation could not be created. Try again.",
  update_error: "The access change could not be saved. Try again.",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");

  const { data } = await supabase
    .from("business_members")
    .select("id,user_id,email,full_name,role,status,created_at,last_access_at")
    .eq("business_owner_id", access.ownerId)
    .order("created_at");

  const memberRows = [...(data ?? [])];
  if (!memberRows.some((member) => member.role === "owner")) {
    memberRows.unshift({
      id: `primary-owner-${access.ownerId}`,
      user_id: access.ownerId,
      email: access.role === "owner" ? access.user.email || "Primary owner account" : "Primary owner account",
      full_name: null,
      role: "owner",
      status: "active",
      created_at: "",
      last_access_at: null,
    });
  }
  const members = memberRows.sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return (a.full_name || a.email).localeCompare(b.full_name || b.email);
  });
  const editable = canManageTeam(access);
  const result = query.result ? resultMessages[query.result] : null;
  const resultIsError = query.result && !["invited", "existing_granted", "updated"].includes(query.result);

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader eyebrow="Login permissions" title="Team access" />
      {result && <p className={resultIsError ? "error-box" : "success-box"}>{result}</p>}

      {editable && (
        <form action={inviteMember} className="panel form-grid">
          <label>Full name<input name="full_name" autoComplete="name" placeholder="Optional" /></label>
          <label>Email<input name="email" type="email" required autoComplete="email" placeholder="employee@example.com" /></label>
          <label className="span-2">Access level<select name="role" defaultValue="field">{assignableRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <div className="form-actions span-2"><button className="button button--gold">Send secure invitation</button></div>
        </form>
      )}

      <section className="panel team-access-panel">
        <div className="panel-heading"><div><h2>People with access</h2><p>The primary owner account is always shown and cannot be disabled.</p></div></div>
        <div className="team-access-list">
          {members.map((member) => {
            const role = member.role as BusinessRole;
            const owner = role === "owner";
            const suspended = member.status === "suspended";
            return (
              <article key={member.id} className={suspended ? "team-access-member team-access-member--suspended" : "team-access-member"}>
                <div className="team-access-identity">
                  <strong>{member.full_name || member.email}</strong>
                  {member.full_name && <span>{member.email}</span>}
                  <small>{roleLabels[role] || role} · {owner ? "Primary account" : member.status}</small>
                </div>
                {editable && !owner && (
                  <div className="team-access-actions">
                    <form action={updateMember}>
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="member_action" value="role" />
                      <label><span className="sr-only">Access level</span><select name="role" defaultValue={role}>{assignableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <button className="button button--outline">Save role</button>
                    </form>
                    <form action={updateMember}>
                      <input type="hidden" name="member_id" value={member.id} />
                      <input type="hidden" name="member_action" value="toggle" />
                      <button className="button button--outline">{suspended ? "Restore access" : "Disable access"}</button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
          {!members.length && <p className="muted">No accounts are configured for this workspace.</p>}
        </div>
      </section>

      <section className="team-role-grid" aria-label="Access level guide">
        <article><strong>Administrator</strong><span>Full working access, settings, and team logins.</span></article>
        <article><strong>Estimator</strong><span>Customers, estimates, projects, and sales workflows.</span></article>
        <article><strong>Field employee</strong><span>Jobsites, project work, photos, tasks, and time.</span></article>
        <article><strong>View only</strong><span>Can review records without changing them.</span></article>
      </section>
    </div>
  );
}
