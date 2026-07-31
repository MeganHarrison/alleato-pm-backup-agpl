/**
 * RLS Regression Test - User Setup
 *
 * Creates 4 test personas in the PM APP Supabase project (lgveqfnpkxvzbnnwuled).
 * Idempotent: if a user already exists, reuses them.
 *
 * Outputs user IDs on success. Passwords are written to .env.local (gitignored).
 *
 * Run: tsx tests/rls-regression/setup.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("Source your .env file first: set -a && source .env && set +a");
  process.exit(1);
}

const PROJECT_67_ID = 67; // Vermillion Rise Warehouse

const PERSONAS = [
  {
    key: "admin",
    email: "rls-test-admin@alleato.test",
    fullName: "RLS Test Admin",
    role: "admin",
    isAdmin: true,
    projectAccess: "all" as const,
  },
  {
    key: "member-67",
    email: "rls-test-member-67@alleato.test",
    fullName: "RLS Test Member 67",
    role: "team",
    isAdmin: false,
    projectAccess: 67 as const,
  },
  {
    key: "member-none",
    email: "rls-test-member-none@alleato.test",
    fullName: "RLS Test Member None",
    role: "team",
    isAdmin: false,
    projectAccess: "none" as const,
  },
  {
    key: "external",
    email: "rls-test-external@alleato.test",
    fullName: "RLS Test External Viewer",
    role: "viewer",
    isAdmin: false,
    projectAccess: 67 as const,
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePassword(): string {
  return crypto.randomBytes(20).toString("base64url") + "Aa1!";
}

function envLocalPath(): string {
  return path.join(__dirname, ".env.local");
}

function loadExistingPasswords(): Record<string, string> {
  const envPath = envLocalPath();
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^RLS_TEST_(\w+)_PASSWORD=(.+)$/);
    if (match) {
      // Convert back from MEMBER_67 → member-67
      const rawKey = match[1].toLowerCase().replace(/_(\d)/g, "-$1");
      result[rawKey] = match[2];
    }
  }
  return result;
}

function toEnvKey(personaKey: string): string {
  // Normalize dashes to underscores for valid env var names
  return personaKey.replace(/-/g, "_").toUpperCase();
}

function savePasswords(passwords: Record<string, string>): void {
  const envPath = envLocalPath();
  const lines = [
    "# RLS Regression Test - Generated Passwords",
    "# DO NOT COMMIT — this file is gitignored",
    "",
    ...Object.entries(passwords).map(
      ([key, pwd]) => `RLS_TEST_${toEnvKey(key)}_PASSWORD=${pwd}`
    ),
    "",
  ];
  fs.writeFileSync(envPath, lines.join("\n"), "utf-8");
  console.log(`  Passwords written to ${envPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== RLS Regression Test Setup ===");
  console.log(`Supabase project: lgveqfnpkxvzbnnwuled`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log("");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existingPasswords = loadExistingPasswords();
  const passwords: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  // -------------------------------------------------------------------------
  // Step 1: Create auth users
  // -------------------------------------------------------------------------
  console.log("Step 1: Creating auth users...");

  for (const persona of PERSONAS) {
    // Reuse existing password if we already created this user before
    const pwd = existingPasswords[persona.key] ?? generatePassword();
    passwords[persona.key] = pwd;

    // Check if user already exists by listing users and searching
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listErr) {
      console.error(`  Error listing users: ${listErr.message}`);
      process.exit(1);
    }

    const existing = listData.users.find((u) => u.email === persona.email);

    if (existing) {
      userIds[persona.key] = existing.id;
      // Always sync the password so .env.local stays authoritative
      const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: pwd,
      });
      if (pwErr) {
        console.warn(`  [WARN] Could not sync password for ${persona.email}: ${pwErr.message}`);
      } else {
        console.log(`  [SYNC] ${persona.email} — already exists (${existing.id}), password synced`);
      }
    } else {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: persona.email,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: persona.fullName },
      });

      if (createErr) {
        console.error(`  Error creating ${persona.email}: ${createErr.message}`);
        process.exit(1);
      }

      userIds[persona.key] = createData.user.id;
      console.log(`  [CREATE] ${persona.email} → ${createData.user.id}`);
    }
  }

  console.log("");
  savePasswords(passwords);
  console.log("");

  // -------------------------------------------------------------------------
  // Step 2: Upsert user_profiles rows
  // -------------------------------------------------------------------------
  console.log("Step 2: Upserting user_profiles rows...");

  for (const persona of PERSONAS) {
    const uid = userIds[persona.key];

    const { error } = await admin.from("user_profiles").upsert(
      {
        id: uid,
        email: persona.email,
        full_name: persona.fullName,
        role: persona.role,
        is_admin: persona.isAdmin,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error(`  Error upserting user_profiles for ${persona.email}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  [OK] user_profiles → ${persona.email} (is_admin=${persona.isAdmin}, role=${persona.role})`);
  }

  console.log("");

  // -------------------------------------------------------------------------
  // Step 3: Create people rows + users_auth mappings
  // -------------------------------------------------------------------------
  // RLS policies resolve access via: auth.uid() → users_auth.auth_user_id
  //   → users_auth.person_id → people.id → project_directory_memberships.person_id
  // So test users need people rows + users_auth rows before memberships can be inserted.
  // -------------------------------------------------------------------------
  console.log("Step 3: Creating people + users_auth rows...");

  const personIds: Record<string, string> = {};

  for (const persona of PERSONAS) {
    const uid = userIds[persona.key];

    // Check if users_auth already maps this auth user
    const { data: existingAuth, error: authCheckErr } = await admin
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if (authCheckErr) {
      console.error(`  Error checking users_auth for ${persona.email}: ${authCheckErr.message}`);
      process.exit(1);
    }

    if (existingAuth) {
      personIds[persona.key] = existingAuth.person_id;
      console.log(`  [SKIP] users_auth already mapped for ${persona.email} → person ${existingAuth.person_id}`);
      continue;
    }

    // Create a people row
    const nameParts = persona.fullName.split(" ");
    const { data: personData, error: personErr } = await admin
      .from("people")
      .insert({
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" "),
        email: persona.email,
        person_type: "contact",
        status: "active",
      })
      .select("id")
      .single();

    if (personErr || !personData) {
      console.error(`  Error creating people row for ${persona.email}: ${personErr?.message}`);
      process.exit(1);
    }

    const personId = personData.id;
    personIds[persona.key] = personId;
    console.log(`  [CREATE] people row → ${persona.email} = ${personId}`);

    // Create users_auth mapping
    const { error: uaErr } = await admin.from("users_auth").insert({
      auth_user_id: uid,
      person_id: personId,
    });

    if (uaErr) {
      console.error(`  Error creating users_auth for ${persona.email}: ${uaErr.message}`);
      process.exit(1);
    }

    console.log(`  [CREATE] users_auth → auth_user_id=${uid}, person_id=${personId}`);
  }

  console.log("");

  // -------------------------------------------------------------------------
  // Step 4: Insert project_directory_memberships where needed
  // -------------------------------------------------------------------------
  console.log("Step 4: Setting up project memberships...");

  // member-67: project 67 full member (employee)
  // external:  project 67 read-only (subcontractor — closest allowed value)
  // admin:     admin sees everything via is_admin RLS policy — no membership needed
  // member-none: no membership rows — should see ~0 project-scoped rows

  const memberships = [
    {
      persona: "member-67",
      projectId: PROJECT_67_ID,
      userType: "employee",        // check constraint: employee | subcontractor
      role: "team",
    },
    {
      persona: "external",
      projectId: PROJECT_67_ID,
      userType: "subcontractor",   // closest to "external viewer" allowed
      role: "viewer",
    },
  ];

  for (const m of memberships) {
    const personId = personIds[m.persona];
    if (!personId) {
      console.error(`  No person_id found for ${m.persona} — skipping membership`);
      continue;
    }

    // Check for existing membership
    const { data: existing, error: checkErr } = await admin
      .from("project_directory_memberships")
      .select("id")
      .eq("person_id", personId)
      .eq("project_id", m.projectId)
      .maybeSingle();

    if (checkErr) {
      console.error(`  Error checking membership for ${m.persona}: ${checkErr.message}`);
      process.exit(1);
    }

    if (existing) {
      console.log(`  [SKIP] ${m.persona} membership on project ${m.projectId} — already exists`);
      continue;
    }

    const { error: insertErr } = await admin.from("project_directory_memberships").insert({
      person_id: personId,
      project_id: m.projectId,
      user_type: m.userType,
      role: m.role,
      status: "active",
    });

    if (insertErr) {
      console.error(
        `  Error inserting membership for ${m.persona}: ${insertErr.message}`
      );
      process.exit(1);
    }

    console.log(`  [CREATE] ${m.persona} → project ${m.projectId} (${m.userType})`);
  }

  console.log("");

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("=== Setup Complete ===");
  console.log("");
  console.log("User IDs:");
  for (const [key, id] of Object.entries(userIds)) {
    const persona = PERSONAS.find((p) => p.key === key)!;
    console.log(`  ${key.padEnd(14)} ${id}  <${persona.email}>`);
  }
  console.log("");
  console.log("Passwords stored in tests/rls-regression/.env.local (gitignored).");
  console.log("");
  console.log("Next: run probe.ts for each persona to capture pre-migration baseline.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
