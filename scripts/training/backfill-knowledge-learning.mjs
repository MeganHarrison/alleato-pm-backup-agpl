#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const guidesDir = path.join(repoRoot, "frontend/src/content/training-guides");
const checkOnly = process.argv.includes("--check");

function loadEnvFile(filePath) {
  try {
    const contents = requireRead(filePath);
    for (const rawLine of contents.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...parts] = line.split("=");
      if (process.env[key] !== undefined) continue;
      process.env[key] = parts
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/gu, "");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function requireRead(filePath) {
  // Keep environment loading synchronous so database setup is complete before
  // any module-level connection is created.
  return readFileSync(filePath, "utf8");
}

function loadEnvironment() {
  loadEnvFile(
    process.env.ALLEATO_MACHINE_ENV_FILE ||
      path.join(
        os.homedir(),
        ".codex/capabilities/alleato-project-management.env",
      ),
  );
  for (const relativePath of [
    ".env",
    ".env.local",
    "frontend/.env",
    "frontend/.env.local",
  ]) {
    loadEnvFile(path.join(repoRoot, relativePath));
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Run the registered database-capability bootstrap first.",
    );
  }
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseGuide(source, fileName) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u);
  if (!match) throw new Error(`${fileName}: expected YAML frontmatter.`);

  const metadata = {};
  let activeList = null;
  for (const rawLine of match[1].split(/\r?\n/u)) {
    if (!rawLine.trim()) continue;
    const listItem = rawLine.match(/^\s+-\s+(.+)$/u);
    if (listItem && activeList) {
      metadata[activeList].push(parseScalar(listItem[1]));
      continue;
    }

    const field = rawLine.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/u);
    if (!field) {
      throw new Error(`${fileName}: unsupported frontmatter line "${rawLine}".`);
    }
    const [, key, value = ""] = field;
    if (value.trim()) {
      metadata[key] = parseScalar(value);
      activeList = null;
    } else {
      metadata[key] = [];
      activeList = key;
    }
  }

  for (const required of ["slug", "title", "description", "roleIds"]) {
    if (!metadata[required]) {
      throw new Error(`${fileName}: missing ${required} frontmatter.`);
    }
  }
  if (!Array.isArray(metadata.roleIds) || metadata.roleIds.length === 0) {
    throw new Error(`${fileName}: roleIds must contain at least one role.`);
  }

  const body = match[2].trim();
  if (!body) throw new Error(`${fileName}: guide body is empty.`);

  return {
    slug: metadata.slug,
    title: metadata.title,
    description: metadata.description,
    roleIds: metadata.roleIds,
    body,
    sourcePath: `frontend/src/content/training-guides/${fileName}`,
    sourceHash: createHash("sha256").update(source).digest("hex"),
  };
}

async function loadGuides() {
  const fileNames = (await readdir(guidesDir))
    .filter((fileName) => fileName.endsWith(".mdx"))
    .sort();
  if (fileNames.length === 0) {
    throw new Error(`No MDX training guides found under ${guidesDir}.`);
  }
  return Promise.all(
    fileNames.map(async (fileName) =>
      parseGuide(
        await readFile(path.join(guidesDir, fileName), "utf8"),
        fileName,
      ),
    ),
  );
}

const courseSpecs = [
  {
    slug: "alleato-pm-software-orientation",
    title: "Alleato PM Software Orientation",
    summary: "Learn the application map and the standard path for finding help.",
    outcome:
      "Navigate Alleato PM, identify the system of record for each workflow, and find the correct software guide.",
    guideSlug: "alleato-pm-software-guide",
    estimatedMinutes: 45,
    moduleTitle: "Application orientation",
  },
  {
    slug: "project-management-fundamentals",
    title: "Project Management Fundamentals",
    summary:
      "The core office-side practices for running a commercial construction project.",
    outcome:
      "Apply Alleato's core project-management practices from document review through closeout.",
    guideSlug: "pm-handbook",
    estimatedMinutes: 180,
    moduleTitle: "Project management handbook",
  },
  {
    slug: "field-leadership-fundamentals",
    title: "Field Leadership Fundamentals",
    summary: "The core field-side practices for running a safe, coordinated jobsite.",
    outcome:
      "Apply Alleato's field planning, documentation, quality, safety, and trade-coordination practices.",
    guideSlug: "superintendent-handbook",
    estimatedMinutes: 150,
    moduleTitle: "Field leadership handbook",
  },
  {
    slug: "coaching-with-the-skill-wheel",
    title: "Coaching with the Skill Wheel",
    summary:
      "A focused manager conversation that turns evidence into a practical growth plan.",
    outcome:
      "Run a skill-wheel coaching conversation and leave with clear practice and feedback commitments.",
    guideSlug: "manager-coaching-guide",
    estimatedMinutes: 60,
    moduleTitle: "Manager coaching guide",
  },
];

const programSpecs = [
  {
    slug: "project-manager-onboarding",
    title: "Project Manager Onboarding",
    description:
      "Recommended foundation for project engineers, assistant project managers, and project managers.",
    courseSlugs: [
      "alleato-pm-software-orientation",
      "project-management-fundamentals",
    ],
    roleSlugs: [
      "project-engineer",
      "assistant-project-manager",
      "project-manager",
    ],
  },
  {
    slug: "superintendent-onboarding",
    title: "Superintendent Onboarding",
    description:
      "Recommended foundation for assistant superintendents and superintendents.",
    courseSlugs: [
      "alleato-pm-software-orientation",
      "field-leadership-fundamentals",
    ],
    roleSlugs: ["assistant-superintendent", "superintendent"],
  },
  {
    slug: "manager-development",
    title: "Manager Development",
    description:
      "Recommended coaching practice for project managers and superintendents.",
    courseSlugs: ["coaching-with-the-skill-wheel"],
    roleSlugs: ["project-manager", "superintendent"],
  },
];

async function resolveAdmin(sql) {
  const rows = await sql`
    select profile.id
    from public.user_profiles profile
    join public.users_auth identity on identity.auth_user_id = profile.id
    join public.people person on person.id = identity.person_id
    where profile.is_admin
      and profile.is_active
      and person.status = 'active'
    order by profile.created_at
    limit 1
  `;
  if (!rows[0]) {
    throw new Error(
      "No active mapped administrator can own imported training content.",
    );
  }
  return rows[0].id;
}

async function upsertGuide(sql, guide, adminId) {
  const existingRows = await sql`
    select id, source_id
    from public.knowledge_content_item
    where source_type = 'native_content'
      and metadata->>'import_key' = ${guide.slug}
    limit 1
  `;

  let nativeId;
  let contentId;
  if (existingRows[0]) {
    contentId = existingRows[0].id;
    nativeId = existingRows[0].source_id;
    const sourceRows = await sql`
      update public.knowledge_native_content
      set
        body_markdown = ${guide.body},
        updated_by = ${adminId}
      where id::text = ${nativeId}
      returning id
    `;
    if (!sourceRows[0]) {
      throw new Error(
        `Imported guide "${guide.slug}" references missing native content "${nativeId}".`,
      );
    }
    await sql`
      update public.knowledge_content_item
      set
        title = ${guide.title},
        summary = ${guide.description},
        content_kind = 'article',
        lifecycle_status = 'published',
        visibility = 'role',
        owner_user_id = ${adminId},
        reviewer_user_id = ${adminId},
        published_at = coalesce(published_at, now()),
        metadata = metadata || ${sql.json({
          import_key: guide.slug,
          source_path: guide.sourcePath,
          source_hash: guide.sourceHash,
        })}
      where id = ${contentId}
    `;
  } else {
    const sourceRows = await sql`
      insert into public.knowledge_native_content (
        body_markdown,
        created_by,
        updated_by
      )
      values (${guide.body}, ${adminId}, ${adminId})
      returning id
    `;
    nativeId = sourceRows[0].id;
    const contentRows = await sql`
      insert into public.knowledge_content_item (
        slug,
        title,
        summary,
        content_kind,
        lifecycle_status,
        visibility,
        source_type,
        source_id,
        owner_user_id,
        reviewer_user_id,
        published_at,
        metadata
      )
      values (
        ${`native-${guide.slug}`},
        ${guide.title},
        ${guide.description},
        'article',
        'published',
        'role',
        'native_content',
        ${nativeId},
        ${adminId},
        ${adminId},
        now(),
        ${sql.json({
          import_key: guide.slug,
          source_path: guide.sourcePath,
          source_hash: guide.sourceHash,
        })}
      )
      returning id
    `;
    contentId = contentRows[0].id;
  }

  const roleRows = await sql`
    select id, slug
    from public.training_role
    where slug in ${sql(guide.roleIds)}
  `;
  const foundRoleSlugs = new Set(roleRows.map((role) => role.slug));
  const missingRoles = guide.roleIds.filter((slug) => !foundRoleSlugs.has(slug));
  if (missingRoles.length > 0) {
    throw new Error(
      `Guide "${guide.slug}" references unknown training roles: ${missingRoles.join(", ")}.`,
    );
  }

  await sql`
    delete from public.knowledge_content_role
    where content_item_id = ${contentId}
  `;
  for (const role of roleRows) {
    await sql`
      insert into public.knowledge_content_role (content_item_id, role_id)
      values (${contentId}, ${role.id})
      on conflict do nothing
    `;
  }

  return { contentId, action: existingRows[0] ? "updated" : "created" };
}

async function ensureCourse(sql, spec, guideMap, adminId) {
  const guide = guideMap.get(spec.guideSlug);
  if (!guide) {
    throw new Error(
      `Course "${spec.slug}" cannot find imported guide "${spec.guideSlug}".`,
    );
  }

  let courseRows = await sql`
    select id, lifecycle_status
    from public.learning_course
    where slug = ${spec.slug}
    limit 1
  `;
  const courseWasPublished = courseRows[0]?.lifecycle_status === "published";
  let action = "existing";
  if (!courseRows[0]) {
    courseRows = await sql`
      select public.create_learning_course(
        p_slug => ${spec.slug},
        p_title => ${spec.title},
        p_outcome => ${spec.outcome},
        p_summary => ${spec.summary},
        p_difficulty => 'intro',
        p_estimated_minutes => ${spec.estimatedMinutes},
        p_visibility => 'role',
        p_completion_rule => 'all_required'
      ) as id
    `;
    courseRows[0].lifecycle_status = "draft";
    action = "created";
  }
  const courseId = courseRows[0].id;

  await sql`
    update public.learning_course
    set
      title = ${spec.title},
      summary = ${spec.summary},
      outcome = ${spec.outcome},
      difficulty = 'intro',
      estimated_minutes = ${spec.estimatedMinutes},
      visibility = 'role',
      owner_user_id = ${adminId},
      reviewer_user_id = ${adminId}
    where id = ${courseId}
  `;

  const courseCatalogRows = await sql`
    select content_item_id
    from public.learning_course
    where id = ${courseId}
    limit 1
  `;
  const courseContentItemId = courseCatalogRows[0]?.content_item_id;
  if (!courseContentItemId) {
    throw new Error(`Course "${spec.title}" is missing its catalog identity.`);
  }
  await sql`
    delete from public.knowledge_content_role
    where content_item_id = ${courseContentItemId}
  `;
  await sql`
    insert into public.knowledge_content_role (content_item_id, role_id)
    select ${courseContentItemId}, role_id
    from public.knowledge_content_role
    where content_item_id = ${guide.contentId}
    on conflict do nothing
  `;

  let sectionRows = await sql`
    select id
    from public.learning_course_section
    where course_id = ${courseId}
      and sort_order = 0
    limit 1
  `;
  if (!sectionRows[0]) {
    sectionRows = await sql`
      insert into public.learning_course_section (
        course_id,
        title,
        sort_order
      )
      values (${courseId}, ${spec.moduleTitle}, 0)
      returning id
    `;
  } else {
    await sql`
      update public.learning_course_section
      set title = ${spec.moduleTitle}
      where id = ${sectionRows[0].id}
    `;
  }

  await sql`
    insert into public.learning_course_item (
      section_id,
      content_item_id,
      sort_order,
      required,
      estimated_minutes
    )
    values (
      ${sectionRows[0].id},
      ${guide.contentId},
      0,
      true,
      ${spec.estimatedMinutes}
    )
    on conflict (section_id, content_item_id) do update
    set
      sort_order = excluded.sort_order,
      required = excluded.required,
      estimated_minutes = excluded.estimated_minutes
  `;

  const blockerRows = await sql`
    select public.learning_course_publication_blockers(${courseId}) as blockers
  `;
  const blockers = blockerRows[0]?.blockers ?? [];
  if (blockers.length > 0) {
    throw new Error(
      `Course "${spec.title}" is blocked from publication: ${blockers.join(" ")}`,
    );
  }
  if (!courseWasPublished) {
    await sql`select public.publish_learning_course(${courseId})`;
  }

  return { courseId, action };
}

async function roleHasActiveEmployees(sql, roleId) {
  const rows = await sql`
    select count(*)::integer as count
    from public.user_profiles profile
    join public.training_role role on role.id = ${roleId}
    where profile.is_active
      and profile.role is not null
      and (
        lower(btrim(profile.role)) = lower(role.name)
        or lower(btrim(profile.role)) = lower(role.slug)
        or exists (
          select 1
          from unnest(role.aliases) alias
          where lower(btrim(alias)) = lower(btrim(profile.role))
        )
      )
  `;
  return rows[0].count > 0;
}

async function ensureProgram(sql, spec, courseMap, adminId) {
  let programRows = await sql`
    select id
    from public.learning_program
    where slug = ${spec.slug}
    limit 1
  `;
  let action = "existing";
  if (!programRows[0]) {
    programRows = await sql`
      insert into public.learning_program (
        slug,
        title,
        description,
        lifecycle_status,
        owner_user_id,
        reviewer_user_id,
        published_at
      )
      values (
        ${spec.slug},
        ${spec.title},
        ${spec.description},
        'published',
        ${adminId},
        ${adminId},
        now()
      )
      returning id
    `;
    action = "created";
  } else {
    await sql`
      update public.learning_program
      set
        title = ${spec.title},
        description = ${spec.description},
        lifecycle_status = 'published',
        owner_user_id = ${adminId},
        reviewer_user_id = ${adminId},
        published_at = coalesce(published_at, now())
      where id = ${programRows[0].id}
    `;
  }
  const programId = programRows[0].id;

  for (const [sortOrder, courseSlug] of spec.courseSlugs.entries()) {
    const course = courseMap.get(courseSlug);
    if (!course) {
      throw new Error(
        `Program "${spec.slug}" references missing course "${courseSlug}".`,
      );
    }
    await sql`
      insert into public.learning_program_course (
        program_id,
        course_id,
        sort_order,
        required
      )
      values (${programId}, ${course.courseId}, ${sortOrder}, true)
      on conflict (program_id, course_id) do update
      set
        sort_order = excluded.sort_order,
        required = excluded.required
    `;
  }

  const roleRows = await sql`
    select id, slug
    from public.training_role
    where slug in ${sql(spec.roleSlugs)}
  `;
  const foundRoleSlugs = new Set(roleRows.map((role) => role.slug));
  const missingRoles = spec.roleSlugs.filter((slug) => !foundRoleSlugs.has(slug));
  if (missingRoles.length > 0) {
    throw new Error(
      `Program "${spec.slug}" references unknown roles: ${missingRoles.join(", ")}.`,
    );
  }

  const assignmentResults = [];
  for (const role of roleRows) {
    const existingAssignments = await sql`
      select id
      from public.learning_assignment
      where assignment_kind = 'program'
        and program_id = ${programId}
        and target_type = 'role'
        and target_role_id = ${role.id}
        and requirement = 'recommended'
        and active
      limit 1
    `;
    if (existingAssignments[0]) {
      assignmentResults.push({ role: role.slug, action: "existing" });
      continue;
    }
    if (!(await roleHasActiveEmployees(sql, role.id))) {
      assignmentResults.push({
        role: role.slug,
        action: "skipped:no-active-role-members",
      });
      continue;
    }
    await sql`
      insert into public.learning_assignment (
        assignment_kind,
        program_id,
        target_type,
        target_role_id,
        requirement,
        assigned_by,
        reason
      )
      values (
        'program',
        ${programId},
        'role',
        ${role.id},
        'recommended',
        ${adminId},
        'Role-based onboarding and professional growth recommendation'
      )
    `;
    assignmentResults.push({ role: role.slug, action: "created" });
  }

  return { programId, action, assignmentResults };
}

loadEnvironment();
const guides = await loadGuides();
const db = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
  idle_timeout: 5,
});

try {
  if (checkOnly) {
    const counts = await db`
      select
        (select count(*)::integer
          from public.knowledge_content_item
          where source_type = 'native_content'
            and metadata ? 'import_key') as imported_guides,
        (select count(*)::integer
          from public.learning_course
          where slug in ${db(courseSpecs.map((course) => course.slug))}) as starter_courses,
        (select count(*)::integer
          from public.learning_program
          where slug in ${db(programSpecs.map((program) => program.slug))}) as starter_programs,
        (select count(*)::integer
          from public.learning_course course
          where course.slug in ${db(courseSpecs.map((course) => course.slug))}
            and not exists (
              select 1
              from public.knowledge_content_role role_link
              where role_link.content_item_id = course.content_item_id
            )) as courses_without_roles
    `;
    if (
      counts[0].imported_guides !== guides.length ||
      counts[0].starter_courses !== courseSpecs.length ||
      counts[0].starter_programs !== programSpecs.length ||
      counts[0].courses_without_roles !== 0
    ) {
      throw new Error(
        "Knowledge-learning backfill is incomplete. Run without --check.",
      );
    }
    console.log(JSON.stringify({ mode: "check", counts: counts[0] }, null, 2));
  } else {
    const result = await db.begin(async (sql) => {
    const adminId = await resolveAdmin(sql);
    await sql`select set_config('request.jwt.claim.sub', ${adminId}, true)`;

    const guideMap = new Map();
    const guideResults = [];
    for (const guide of guides) {
      const result = await upsertGuide(sql, guide, adminId);
      guideMap.set(guide.slug, result);
      guideResults.push({ slug: guide.slug, action: result.action });
    }

    const courseMap = new Map();
    const courseResults = [];
    for (const spec of courseSpecs) {
      const result = await ensureCourse(sql, spec, guideMap, adminId);
      courseMap.set(spec.slug, result);
      courseResults.push({ slug: spec.slug, action: result.action });
    }

    const programResults = [];
    for (const spec of programSpecs) {
      const result = await ensureProgram(sql, spec, courseMap, adminId);
      programResults.push({
        slug: spec.slug,
        action: result.action,
        assignments: result.assignmentResults,
      });
    }

    const counts = await sql`
      select
        (select count(*)::integer
          from public.knowledge_content_item
          where source_type = 'native_content'
            and metadata ? 'import_key') as imported_guides,
        (select count(*)::integer
          from public.learning_course
          where slug in ${sql(courseSpecs.map((course) => course.slug))}) as starter_courses,
        (select count(*)::integer
          from public.learning_program
          where slug in ${sql(programSpecs.map((program) => program.slug))}) as starter_programs,
        (select count(*)::integer
          from public.learning_enrollment) as enrollments
    `;

    return {
      mode: "apply",
      counts: counts[0],
      guides: guideResults,
      courses: courseResults,
      programs: programResults,
    };
    });

    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await db.end();
}
