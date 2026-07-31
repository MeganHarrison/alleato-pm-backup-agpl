import postgres from "postgres";

const db = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function asAdmin(adminId, callback) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${adminId}, true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: adminId,
      role: "authenticated",
    })}, true)`;
    await tx.unsafe("set local role authenticated");
    return callback(tx);
  });
}

async function main() {
  const [admin] = await db`
    select profile.id
    from public.user_profiles profile
    join public.users_auth auth_user on auth_user.auth_user_id = profile.id
    join public.people person on person.id = auth_user.person_id
    where profile.is_active = true
      and profile.is_admin = true
      and person.status = 'active'
    limit 1
  `;
  if (!admin) {
    throw new Error(
      "No active learning administrator was available for authenticated readback.",
    );
  }

  let anonymousCode = null;
  try {
    await db.unsafe(
      "select * from public.get_knowledge_content_engagement_summary() limit 1",
    );
  } catch (error) {
    anonymousCode = error.code;
  }

  const snapshot = await asAdmin(admin.id, async (tx) => {
    const [engagement] = await tx.unsafe(`
      select
        count(*)::int as catalog_rows,
        count(*) filter (where tracking_supported)::int as tracked_rows,
        sum(unique_viewers)::int as total_unique_viewers,
        sum(completed_count)::int as total_completions,
        sum(watch_seconds)::int as total_watch_seconds
      from public.get_knowledge_content_engagement_summary()
    `);
    const [managers] = await tx.unsafe(`
      select count(*)::int as manager_count
      from public.get_knowledge_content_managers()
    `);
    return { engagement, managers };
  });

  let invalidFieldCode = null;
  try {
    await asAdmin(admin.id, async (tx) => {
      const [item] = await tx.unsafe(
        "select id from public.knowledge_content_item order by created_at limit 1",
      );
      await tx`
        select *
        from public.bulk_update_knowledge_content_governance(
          array[${item.id}]::uuid[],
          'unsupported_field',
          'x'
        )
      `;
    });
  } catch (error) {
    invalidFieldCode = error.code;
  }

  let missingItemCode = null;
  try {
    await asAdmin(admin.id, async (tx) => {
      await tx.unsafe(
        "select * from public.bulk_update_knowledge_content_governance(array['00000000-0000-0000-0000-000000000001']::uuid[], 'display_area', 'training')",
      );
    });
  } catch (error) {
    missingItemCode = error.code;
  }

  const [permissions] = await db.unsafe(`
    select
      has_function_privilege('anon', 'public.get_knowledge_content_engagement_summary()', 'EXECUTE') as anon_engagement,
      has_function_privilege('authenticated', 'public.get_knowledge_content_engagement_summary()', 'EXECUTE') as authenticated_engagement,
      has_function_privilege('anon', 'public.bulk_update_knowledge_content_governance(uuid[], text, text)', 'EXECUTE') as anon_bulk,
      has_function_privilege('authenticated', 'public.bulk_update_knowledge_content_governance(uuid[], text, text)', 'EXECUTE') as authenticated_bulk
  `);
  const ledger = await db.unsafe(`
    select version, name
    from supabase_migrations.schema_migrations
    where version in ('20260731180000', '20260731210000')
    order by version
  `);
  const [functionContract] = await db.unsafe(`
    select
      pg_get_functiondef(
        'public.get_knowledge_content_engagement_summary()'::regprocedure
      ) like '%public.current_is_app_admin()%' as engagement_uses_app_admin,
      pg_get_functiondef(
        'public.get_knowledge_content_managers()'::regprocedure
      ) like '%public.current_is_app_admin()%' as managers_use_app_admin,
      pg_get_functiondef(
        'public.bulk_update_knowledge_content_governance(uuid[], text, text)'::regprocedure
      ) like '%public.current_is_app_admin()%' as bulk_uses_app_admin,
      pg_get_functiondef(
        'public.bulk_update_knowledge_content_governance(uuid[], text, text)'::regprocedure
      ) like '%normalized_value::date::timestamp at time zone ''UTC''%'
        as bulk_normalizes_calendar_date
  `);

  const result = {
    anonymousCode,
    invalidFieldCode,
    missingItemCode,
    snapshot,
    permissions,
    ledger,
    functionContract,
  };
  console.log(JSON.stringify(result, null, 2));

  if (anonymousCode !== "42501") {
    throw new Error(`Expected anonymous SQLSTATE 42501, received ${anonymousCode}.`);
  }
  if (invalidFieldCode !== "22023") {
    throw new Error(
      `Expected invalid-field SQLSTATE 22023, received ${invalidFieldCode}.`,
    );
  }
  if (missingItemCode !== "P0002") {
    throw new Error(
      `Expected missing-item SQLSTATE P0002, received ${missingItemCode}.`,
    );
  }
  if (
    permissions.anon_engagement ||
    permissions.anon_bulk ||
    !permissions.authenticated_engagement ||
    !permissions.authenticated_bulk
  ) {
    throw new Error("Function execution grants do not match the security contract.");
  }
  const ledgerVersions = ledger.map((entry) => entry.version);
  if (
    !ledgerVersions.includes("20260731180000") ||
    !ledgerVersions.includes("20260731210000")
  ) {
    throw new Error("Migration ledger readback did not find both task migrations.");
  }
  if (Object.values(functionContract).some((value) => value !== true)) {
    throw new Error(
      "Content creator functions do not match the route authorization and calendar-date contracts.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
