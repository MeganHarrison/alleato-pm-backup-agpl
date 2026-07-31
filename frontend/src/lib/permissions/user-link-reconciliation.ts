import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type ServiceClient = SupabaseClient<Database>;

type UserProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean | null;
  is_active: boolean;
  role: string | null;
};

type PersonLinkRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  auth_user_id: string | null;
};

type UserAuthRow = {
  person_id: string;
  auth_user_id: string;
};

export type UserLinkIssue =
  | "missing_person_auth_link"
  | "missing_users_auth_link"
  | "mismatched_users_auth_link"
  | "duplicate_people_email";

export type UserLinkDiagnostic = {
  authUserId: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  issues: UserLinkIssue[];
};

export type ReconcileUserLinksResult = {
  repaired: Array<{
    authUserId: string;
    email: string;
    personId: string;
    actions: Array<"created_person" | "linked_person_auth" | "linked_users_auth">;
  }>;
  unresolved: UserLinkDiagnostic[];
};

type LinkState = {
  profiles: UserProfileRow[];
  people: PersonLinkRow[];
  usersAuth: UserAuthRow[];
};

// Supabase caps every select at 1000 rows by default. The `people` table has
// well over 1000 rows, so an un-paginated fetch silently drops the tail — any
// user whose linked person row falls outside the first page gets a false
// `missing_person_auth_link` diagnostic that "Repair links" can never clear
// (and that the repair path then tries to "fix" by inserting a duplicate).
// Always page through the full result set so link reconciliation sees every row.
const PAGE_SIZE = 1000;

async function loadLinkState(service: ServiceClient): Promise<LinkState> {
  const profiles: UserProfileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await service
      .from("user_profiles")
      .select("id, email, full_name, is_admin, is_active, role")
      .eq("is_active", true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    profiles.push(...((data ?? []) as UserProfileRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const people: PersonLinkRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await service
      .from("people")
      .select("id, first_name, last_name, email, auth_user_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    people.push(...((data ?? []) as PersonLinkRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const usersAuth: UserAuthRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await service
      .from("users_auth")
      .select("person_id, auth_user_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    usersAuth.push(...((data ?? []) as UserAuthRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return { profiles, people, usersAuth };
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function splitName(fullName: string | null, email: string) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    const fallback = email.split("@")[0] || "User";
    return { firstName: fallback, lastName: "" };
  }

  return {
    firstName: parts[0] ?? "User",
    lastName: parts.slice(1).join(" "),
  };
}

function getDiagnosticsFromState(state: LinkState): UserLinkDiagnostic[] {
  const peopleByAuth = new Map(state.people.filter((person) => person.auth_user_id).map((person) => [person.auth_user_id!, person]));
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const peopleByEmail = new Map<string, PersonLinkRow[]>();
  for (const person of state.people) {
    const email = normalizeEmail(person.email);
    if (!email) continue;
    peopleByEmail.set(email, [...(peopleByEmail.get(email) ?? []), person]);
  }

  const usersAuthByAuth = new Map(state.usersAuth.map((row) => [row.auth_user_id, row]));

  const diagnostics: UserLinkDiagnostic[] = [];
  for (const profile of state.profiles) {
    const email = normalizeEmail(profile.email);
    if (!email) continue;

    const personLinkedByAuth = peopleByAuth.get(profile.id) ?? null;
    const usersAuthLink = usersAuthByAuth.get(profile.id) ?? null;
    const personLinkedByUsersAuth = usersAuthLink ? peopleById.get(usersAuthLink.person_id) ?? null : null;
    const matchingPeople = peopleByEmail.get(email) ?? [];
    const issues = new Set<UserLinkIssue>();

    if (!personLinkedByAuth) {
      issues.add("missing_person_auth_link");
      if (matchingPeople.length > 1 && !personLinkedByUsersAuth) {
        issues.add("duplicate_people_email");
      }
    }

    if (!usersAuthLink) {
      issues.add("missing_users_auth_link");
    } else if (personLinkedByAuth && usersAuthLink.person_id !== personLinkedByAuth.id) {
      issues.add("mismatched_users_auth_link");
    }

    if (issues.size > 0) {
      diagnostics.push({
        authUserId: profile.id,
        email,
        fullName: profile.full_name,
        isAdmin: profile.is_admin === true,
        issues: Array.from(issues),
      });
    }
  }

  return diagnostics;
}

export async function findPermissionUserLinkDiagnostics(
  service: ServiceClient,
): Promise<UserLinkDiagnostic[]> {
  return getDiagnosticsFromState(await loadLinkState(service));
}

export async function reconcilePermissionUserLinks(
  service: ServiceClient,
): Promise<ReconcileUserLinksResult> {
  const state = await loadLinkState(service);
  const diagnostics = getDiagnosticsFromState(state);
  const profilesByAuthId = new Map(state.profiles.map((profile) => [profile.id, profile]));
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const peopleByAuth = new Map(state.people.filter((person) => person.auth_user_id).map((person) => [person.auth_user_id!, person]));
  const peopleByEmail = new Map<string, PersonLinkRow[]>();
  for (const person of state.people) {
    const email = normalizeEmail(person.email);
    if (!email) continue;
    peopleByEmail.set(email, [...(peopleByEmail.get(email) ?? []), person]);
  }
  const usersAuthByAuth = new Map(state.usersAuth.map((row) => [row.auth_user_id, row]));

  const repaired: ReconcileUserLinksResult["repaired"] = [];
  const unresolved: UserLinkDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.issues.includes("mismatched_users_auth_link")) {
      unresolved.push(diagnostic);
      continue;
    }

    const profile = profilesByAuthId.get(diagnostic.authUserId);
    if (!profile) continue;

    const actions: ReconcileUserLinksResult["repaired"][number]["actions"] = [];
    let person =
      peopleByAuth.get(profile.id) ??
      (usersAuthByAuth.get(profile.id)
        ? peopleById.get(usersAuthByAuth.get(profile.id)!.person_id)
        : undefined) ??
      null;

    if (!person) {
      const matchingPeople = peopleByEmail.get(normalizeEmail(profile.email)) ?? [];
      if (matchingPeople.length > 1) {
        unresolved.push(diagnostic);
        continue;
      }

      if (matchingPeople.length === 1) {
        person = matchingPeople[0]!;
      } else {
        const { firstName, lastName } = splitName(profile.full_name, profile.email);
        const { data: insertedPerson, error: insertError } = await service
          .from("people")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: normalizeEmail(profile.email),
            job_title: profile.role,
            auth_user_id: profile.id,
            person_type: "user",
            status: "active",
          })
          .select("id, first_name, last_name, email, auth_user_id")
          .single();

        if (insertError || !insertedPerson) throw insertError ?? new Error("Could not create person link");
        person = insertedPerson as PersonLinkRow;
        peopleById.set(person.id, person);
        peopleByAuth.set(profile.id, person);
        actions.push("created_person");
      }
    }

    if (person.auth_user_id !== profile.id) {
      const { data: updatedPerson, error: updateError } = await service
        .from("people")
        .update({
          auth_user_id: profile.id,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", person.id)
        .select("id, first_name, last_name, email, auth_user_id")
        .single();

      if (updateError || !updatedPerson) throw updateError ?? new Error("Could not link person auth account");
      person = updatedPerson as PersonLinkRow;
      peopleById.set(person.id, person);
      peopleByAuth.set(profile.id, person);
      actions.push("linked_person_auth");
    }

    const usersAuthLink = usersAuthByAuth.get(profile.id);
    if (!usersAuthLink || usersAuthLink.person_id !== person.id) {
      const { error: usersAuthError } = await service
        .from("users_auth")
        .upsert(
          { person_id: person.id, auth_user_id: profile.id },
          { onConflict: "person_id" },
        );

      if (usersAuthError) throw usersAuthError;
      usersAuthByAuth.set(profile.id, { person_id: person.id, auth_user_id: profile.id });
      actions.push("linked_users_auth");
    }

    if (actions.length > 0) {
      repaired.push({
        authUserId: profile.id,
        email: normalizeEmail(profile.email),
        personId: person.id,
        actions,
      });
    }
  }

  return { repaired, unresolved };
}
