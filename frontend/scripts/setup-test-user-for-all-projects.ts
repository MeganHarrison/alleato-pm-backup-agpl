import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const testEmail = process.env.TEST_USER_1 ?? "";

if (!supabaseUrl || !supabaseServiceKey || !testEmail) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or TEST_USER_1 in frontend/.env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type AuthUser = {
  id: string;
  email?: string | null;
};

type MembershipRow = {
  id: string;
  project_id: number;
  status: string | null;
};

async function setupTestUserForAllProjects() {
  console.log(`Granting ${testEmail} access to all current projects...\n`);

  const { data: authUsers, error: authUsersError } =
    await supabase.auth.admin.listUsers();
  if (authUsersError) {
    throw authUsersError;
  }

  const authUser = (authUsers.users as AuthUser[]).find(
    (user) => user.email?.toLowerCase() === testEmail.toLowerCase(),
  );
  if (!authUser) {
    throw new Error(
      `Auth user not found for ${testEmail}. Have them sign in once before running this script.`,
    );
  }

  const { data: authLink, error: authLinkError } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (authLinkError) {
    throw authLinkError;
  }
  if (!authLink?.person_id) {
    throw new Error(`No users_auth.person_id link found for ${testEmail}.`);
  }

  const personId = authLink.person_id;

  const { data: projectAdminTemplate, error: templateError } = await supabase
    .from("permission_templates")
    .select("id, name")
    .eq("name", "Project Admin")
    .eq("scope", "project")
    .single();
  if (templateError) {
    throw templateError;
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .order("id", { ascending: true });
  if (projectsError) {
    throw projectsError;
  }
  if (!projects?.length) {
    throw new Error("No projects found.");
  }

  const { data: existingMemberships, error: existingMembershipsError } =
    await supabase
      .from("project_directory_memberships")
      .select("id, project_id, status")
      .eq("person_id", personId);
  if (existingMembershipsError) {
    throw existingMembershipsError;
  }

  const membershipByProjectId = new Map<number, MembershipRow>();
  for (const membership of (existingMemberships ?? []) as MembershipRow[]) {
    const prior = membershipByProjectId.get(membership.project_id);
    if (!prior || prior.status !== "active") {
      membershipByProjectId.set(membership.project_id, membership);
    }
  }

  const inactiveMembershipIds: string[] = [];
  const membershipsToCreate = [];

  for (const project of projects) {
    const existingMembership = membershipByProjectId.get(project.id);
    if (!existingMembership) {
      membershipsToCreate.push({
        person_id: personId,
        project_id: project.id,
        role: "Project Admin",
        status: "active",
        user_type: "employee",
        permission_template_id: projectAdminTemplate.id,
        is_employee_of_company: false,
      });
      continue;
    }

    if (existingMembership.status !== "active") {
      inactiveMembershipIds.push(existingMembership.id);
    }
  }

  if (inactiveMembershipIds.length > 0) {
    const { error: reactivateError } = await supabase
      .from("project_directory_memberships")
      .update({
        role: "Project Admin",
        status: "active",
        user_type: "employee",
        permission_template_id: projectAdminTemplate.id,
        is_employee_of_company: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", inactiveMembershipIds);

    if (reactivateError) {
      throw reactivateError;
    }
  }

  if (membershipsToCreate.length > 0) {
    const { error: insertError } = await supabase
      .from("project_directory_memberships")
      .insert(membershipsToCreate);

    if (insertError) {
      throw insertError;
    }
  }

  const { count: activeMembershipCount, error: verifyError } = await supabase
    .from("project_directory_memberships")
    .select("project_id", { count: "exact", head: true })
    .eq("person_id", personId)
    .eq("status", "active");
  if (verifyError) {
    throw verifyError;
  }

  console.log(`Auth user: ${authUser.id}`);
  console.log(`Person: ${personId}`);
  console.log(`Projects: ${projects.length}`);
  console.log(`Reactivated memberships: ${inactiveMembershipIds.length}`);
  console.log(`Inserted memberships: ${membershipsToCreate.length}`);
  console.log(`Active memberships after run: ${activeMembershipCount}`);

  if (activeMembershipCount !== projects.length) {
    throw new Error(
      `Membership count mismatch after update: expected ${projects.length}, got ${activeMembershipCount}.`,
    );
  }

  console.log("\nDone. The test account now has active membership on every current project.");
}

setupTestUserForAllProjects().catch((error) => {
  console.error("\nFailed to grant all-project access.");
  console.error(error);
  process.exit(1);
});
