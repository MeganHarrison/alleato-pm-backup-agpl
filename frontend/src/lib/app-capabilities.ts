import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  APP_CAPABILITY_FLAGS,
  type AppCapability,
} from "@/lib/permissions-shared";

type AppCapabilityEffect = "allow" | "deny";

export interface AppCapabilityAccess {
  userId: string;
  personId: string | null;
  isAdmin: boolean;
  templateCapabilities: AppCapability[];
  overrides: Partial<Record<AppCapability, AppCapabilityEffect>>;
}

function isAppCapability(value: string): value is AppCapability {
  return APP_CAPABILITY_FLAGS.includes(value as AppCapability);
}

async function withAppDbClient<T>(callback: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const databaseUrl =
    process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("App database URL is not configured for app capability fallback.");
  }

  const pg = await import("pg");
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 1_000,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query("set statement_timeout = '15000ms'");
        return await callback(client);
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
    } finally {
      await pool.end();
    }
  }

  throw lastError;
}

export function hasAppCapability(
  access: AppCapabilityAccess,
  capability: AppCapability,
): boolean {
  if (access.isAdmin) return true;

  const override = access.overrides[capability];
  if (override === "deny") return false;
  if (override === "allow") return true;

  return access.templateCapabilities.includes(capability);
}

export async function loadAppCapabilityAccessForUser(
  userId: string,
): Promise<AppCapabilityAccess | null> {
  const supabase = createServiceClient();

  try {
    const [profileResult, userAuthResult] = await Promise.all([
      serviceDb.from("user_profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle(),
      serviceDb.from("users_auth")
        .select("person_id")
        .eq("auth_user_id", userId)
        .maybeSingle(),
    ]);

    const loadError = profileResult.error ?? userAuthResult.error;
    if (loadError) {
      throw new Error(`Failed to load app capability identity: ${loadError.message}`);
    }

    const isAdmin = profileResult.data?.is_admin === true;
    const personId = userAuthResult.data?.person_id ?? null;

    if (!personId) {
      if (!isAdmin) return null;

      return {
        userId,
        personId: null,
        isAdmin: true,
        templateCapabilities: [],
        overrides: {},
      };
    }

    const [companyTemplateResult, overridesResult] = await Promise.all([
      serviceDb.from("person_company_templates")
        .select("template:permission_templates (granular_flags)")
        .eq("person_id", personId)
        .maybeSingle(),
      serviceDb.from("user_granular_permission_overrides")
        .select("flag, effect")
        .eq("person_id", personId)
        .is("project_id", null),
    ]);

    const capabilityError = companyTemplateResult.error ?? overridesResult.error;
    if (capabilityError) {
      throw new Error(`Failed to load app capability rules: ${capabilityError.message}`);
    }

    const rawTemplate = Array.isArray(companyTemplateResult.data?.template)
      ? companyTemplateResult.data.template[0]
      : companyTemplateResult.data?.template;

    const templateCapabilities = (rawTemplate?.granular_flags ?? []).filter(
      isAppCapability,
    );

    const overrides = (overridesResult.data ?? []).reduce(
      (acc, row) => {
        if (
          isAppCapability(row.flag) &&
          (row.effect === "allow" || row.effect === "deny")
        ) {
          acc[row.flag] = row.effect;
        }
        return acc;
      },
      {} as Partial<Record<AppCapability, AppCapabilityEffect>>,
    );

    return {
      userId,
      personId,
      isAdmin,
      templateCapabilities,
      overrides,
    };
  } catch {
    return loadAppCapabilityAccessForUserFromAppDb(userId);
  }
}

async function loadAppCapabilityAccessForUserFromAppDb(
  userId: string,
): Promise<AppCapabilityAccess | null> {
  return withAppDbClient(async (client) => {
    const identityResult = await client.query(
      `
        select
          coalesce(up.is_admin, false) as is_admin,
          ua.person_id
        from (select $1::uuid as auth_user_id) input
        left join public.user_profiles up on up.id = input.auth_user_id
        left join public.users_auth ua on ua.auth_user_id = input.auth_user_id
      `,
      [userId],
    );
    const identity = identityResult.rows[0] as
      | { is_admin: boolean | null; person_id: string | null }
      | undefined;
    const isAdmin = identity?.is_admin === true;
    const personId = identity?.person_id ?? null;

    if (!personId) {
      if (!isAdmin) return null;
      return {
        userId,
        personId: null,
        isAdmin: true,
        templateCapabilities: [],
        overrides: {},
      };
    }

    const [templateResult, overridesResult] = await Promise.all([
      client.query(
        `
          select pt.granular_flags
          from public.person_company_templates pct
          join public.permission_templates pt on pt.id = pct.template_id
          where pct.person_id = $1
          limit 1
        `,
        [personId],
      ),
      client.query(
        `
          select flag, effect
          from public.user_granular_permission_overrides
          where person_id = $1
            and project_id is null
        `,
        [personId],
      ),
    ]);

    const rawFlags = templateResult.rows[0]?.granular_flags;
    const templateCapabilities = (Array.isArray(rawFlags) ? rawFlags : []).filter(
      isAppCapability,
    );
    const overrides = overridesResult.rows.reduce(
      (acc, row: { flag?: unknown; effect?: unknown }) => {
        if (
          typeof row.flag === "string" &&
          isAppCapability(row.flag) &&
          (row.effect === "allow" || row.effect === "deny")
        ) {
          acc[row.flag] = row.effect;
        }
        return acc;
      },
      {} as Partial<Record<AppCapability, AppCapabilityEffect>>,
    );

    return {
      userId,
      personId,
      isAdmin,
      templateCapabilities,
      overrides,
    };
  });
}

export async function canCurrentUserAccessAppCapability(
  capability: AppCapability,
): Promise<boolean> {
  const user = await getApiRouteUser();
  if (!user) return false;

  const access = await loadAppCapabilityAccessForUser(user.id);
  return access ? hasAppCapability(access, capability) : false;
}

export async function requireCurrentUserAppCapability(
  capability: AppCapability,
  where: string,
  message = "Access denied.",
) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const access = await loadAppCapabilityAccessForUser(user.id);
  if (!access || !hasAppCapability(access, capability)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message,
      status: 403,
    });
  }

  return { user, access };
}
