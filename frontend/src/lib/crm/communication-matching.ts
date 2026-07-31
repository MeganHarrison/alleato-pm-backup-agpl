import "server-only";

import { createHash } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

type SourceSystem = "fireflies" | "outlook" | "teams";

function normalizeDomain(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.includes("@")
    ? value.split("@").at(-1)
    : value.replace(/^https?:\/\//i, "").split("/")[0];
  const domain =
    candidate
      ?.trim()
      .toLowerCase()
      .replace(/^www\./, "") ?? "";
  return domain.includes(".") ? domain : null;
}

function sourceSystem(row: {
  source: string | null;
  source_system: string | null;
  category: string | null;
  type: string | null;
}): SourceSystem | null {
  const value = [row.source, row.source_system, row.category, row.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (value.includes("fireflies")) return "fireflies";
  if (value.includes("outlook") || value.includes("email")) return "outlook";
  if (value.includes("teams")) return "teams";
  return null;
}

function sourceText(row: {
  title: string | null;
  summary: string | null;
  content: string | null;
  participants: string | null;
  participants_array: string[] | null;
  host_email: string | null;
  organizer_email: string | null;
}): string {
  return [
    row.title,
    row.summary,
    row.content,
    row.participants,
    ...(row.participants_array ?? []),
    row.host_email,
    row.organizer_email,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export async function createCrmCommunicationCandidates(options?: {
  since?: string;
  limit?: number;
}) {
  const db = createServiceClient();
  const since =
    options?.since ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2_000);
  const [accountsResult, denylistResult, documentsResult] = await Promise.all([
    db
      .from("crm_account_profiles")
      .select("company_id")
      .is("archived_at", null),
    db
      .from("crm_settings")
      .select("value")
      .eq("key", "free_email_domain_denylist")
      .maybeSingle(),
    db
      .from("document_metadata")
      .select(
        "id, title, summary, content, participants, participants_array, host_email, organizer_email, source, source_system, source_item_id, fireflies_id, content_hash, category, type, date, captured_at, created_at, privacy, access_level",
      )
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);
  const firstError =
    accountsResult.error ?? denylistResult.error ?? documentsResult.error;
  if (firstError) throw firstError;

  const companyIds = (accountsResult.data ?? []).map(
    (account) => account.company_id,
  );
  if (!companyIds.length) {
    return {
      scanned: documentsResult.data?.length ?? 0,
      created: 0,
      skipped: 0,
    };
  }
  const { data: companies, error: companiesError } = await db
    .from("companies")
    .select("id, name, website, contact_email")
    .in("id", companyIds);
  if (companiesError) throw companiesError;

  const denylist = new Set(
    ((denylistResult.data?.value as string[] | null) ?? []).map((domain) =>
      domain.toLowerCase(),
    ),
  );
  let created = 0;
  let skipped = 0;
  for (const document of documentsResult.data ?? []) {
    const system = sourceSystem(document);
    if (!system) continue;
    const privacy =
      `${document.privacy ?? ""} ${document.access_level ?? ""}`.toLowerCase();
    if (
      privacy.includes("private") ||
      privacy.includes("restricted") ||
      privacy.includes("leadership")
    ) {
      skipped += 1;
      continue;
    }
    const haystack = sourceText(document);
    const ranked = (companies ?? [])
      .map((company) => {
        const domains = [
          normalizeDomain(company.contact_email),
          normalizeDomain(company.website),
        ].filter(
          (domain): domain is string =>
            Boolean(domain) && !denylist.has(domain!),
        );
        const matchedDomain = domains.find((domain) =>
          haystack.includes(`@${domain}`),
        );
        const normalizedName = company.name.trim().toLowerCase();
        const nameMatch =
          normalizedName.length >= 4 && haystack.includes(normalizedName);
        const confidence = matchedDomain ? 0.98 : nameMatch ? 0.75 : 0;
        return {
          company,
          confidence,
          signals: {
            exact_company_domain: matchedDomain ?? null,
            company_name_mention: nameMatch,
          },
        };
      })
      .filter((match) => match.confidence > 0)
      .sort((left, right) => right.confidence - left.confidence);
    const best = ranked[0];
    if (!best || ranked[1]?.confidence === best.confidence) {
      skipped += 1;
      continue;
    }
    const externalKey =
      document.source_item_id ?? document.fireflies_id ?? document.id;
    const contentHash =
      document.content_hash ??
      createHash("sha256")
        .update(
          [
            document.id,
            document.title,
            document.date,
            document.captured_at,
          ].join("|"),
        )
        .digest("hex");
    const { data: candidateResult, error: candidateError } = await db.rpc(
      "crm_create_activity_candidate",
      {
        p_source_system: system,
        p_source_external_key: externalKey,
        p_content_hash: contentHash,
        p_source_document_id: document.id,
        p_proposed_company_id: best.company.id,
        p_match_signals: best.signals,
        p_match_confidence: best.confidence,
      },
    );
    if (candidateError) throw candidateError;
    if (candidateResult?.[0]?.created) created += 1;
    else skipped += 1;
  }
  return {
    scanned: documentsResult.data?.length ?? 0,
    created,
    skipped,
    since,
  };
}
