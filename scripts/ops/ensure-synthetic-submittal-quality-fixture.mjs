#!/usr/bin/env node

/**
 * Idempotently strengthens the Goodwill storefront synthetic submittal proof.
 *
 * This adds checkable product data and an 08-43-13 spec source so the AI review
 * can produce real pass/fail findings instead of only missing-information gaps.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const PROJECT_ID = 25125;
const SUBMITTAL_ID = "7dfbccac-6ccf-4d69-8129-7de7918c5248";
const PRODUCT_DOCUMENT_ID =
  "synthetic-submittal:goodwill-storefront-product-data";

const SPEC_CONTENT = [
  "SECTION 08-43-13 ALUMINUM-FRAMED STOREFRONTS",
  "1. Finish: clear anodized aluminum, AA-M12C22A41 Class I. Dark bronze finish is not acceptable unless approved by architect in writing.",
  "2. Acceptable storefront systems: Kawneer Trifab 451T thermal center-glazed storefront or approved equal with 2 inch by 4-1/2 inch framing depth.",
  "3. Glazing: 1 inch insulated low-e glazing unit, tempered where required by code, with U-factor not greater than 0.40 and SHGC not greater than 0.30.",
  "4. Performance: air infiltration not greater than 0.06 cfm per square foot at 6.24 psf; water penetration resistance not less than 8.0 psf; structural design pressure positive and negative 30 psf minimum.",
  "5. Shop drawings must identify A201 exterior elevation opening tags, rough opening dimensions, mullion layout, anchorage, perimeter sealant, sill pan, and lintel coordination.",
  "6. Submittal package must include manufacturer product data, finish samples, glazing data, and installation instructions before approval.",
].join("\n");

const PRODUCT_CONTENT = [
  "SYNTHETIC TEST SUBMITTAL - STOREFRONT PRODUCT DATA",
  "Project: 25-125 Goodwill Noblesville",
  "Submittal: 08-TST-A201 Synthetic Test - Storefront Exterior Elevations",
  "Specification Section: 08-43-13 Aluminum-Framed Storefronts",
  "Submitted finish: dark bronze anodized aluminum.",
  "Manufacturer/System: Kawneer Trifab 451T thermal center-glazed storefront, 2 inch by 4-1/2 inch frame depth.",
  "Glazing: 1 inch insulated low-e tempered glazing unit. Submitted U-factor 0.38. Submitted SHGC 0.29.",
  "Performance: air infiltration 0.06 cfm per square foot at 6.24 psf; water penetration resistance 10.0 psf; structural design pressure positive and negative 35 psf.",
  "Drawing coordination: shop drawings reference A201 exterior elevations. Opening S1 is 10 feet 0 inches wide by 8 feet 0 inches high. Opening S2 is 6 feet 0 inches wide by 7 feet 2 inches high. Mullions align with the A201 storefront elevation grid.",
  "Anchorage and interfaces: perimeter anchors at 24 inches on center maximum; lintel coordination required at storefront head; sill pan and sealant included.",
  "Included documents: manufacturer product data, glazing data, installation instructions, and finish sample.",
].join("\n");

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function buildUrl(path, searchParams = {}) {
  const url = new URL(`/rest/v1/${path}`, SUPABASE_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path, options.searchParams), {
    method: options.method ?? "GET",
    headers: {
      ...headers,
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

async function upsertById(path, id, payload) {
  const existing = await request(path, {
    searchParams: { select: "id", id: `eq.${id}`, limit: "1" },
  });

  if (existing.length > 0) {
    return request(path, {
      method: "PATCH",
      searchParams: { id: `eq.${id}` },
      prefer: "return=representation",
      body: payload,
    });
  }

  return request(path, {
    method: "POST",
    prefer: "return=representation",
    body: { id, ...payload },
  });
}

async function upsertSpecificationSection() {
  const existing = await request("specification_sections", {
    searchParams: { select: "id", project_id: `eq.${PROJECT_ID}`, section_number: "eq.08-43-13", limit: "1" },
  });
  const payload = {
    project_id: PROJECT_ID, section_number: "08-43-13", title: "Aluminum-Framed Storefronts - Synthetic Test",
    description: "08 - Openings", division: "08 - Openings", specification_type: "synthetic_test", status: "active",
    content: SPEC_CONTENT,
    ai_summary: "Synthetic 08-43-13 storefront spec for AI review quality proof. Includes one intentional finish mismatch against the synthetic product data.",
    requirements: [{ type: "manufacturer", requirement: "Kawneer Trifab 451T thermal storefront or approved equal" }, { type: "performance", requirement: "U-factor <= 0.40, SHGC <= 0.30, air <= 0.06 cfm/sf, water >= 8 psf, structural +/-30 psf" }, { type: "finish", requirement: "Clear anodized aluminum Class I; dark bronze not accepted" }],
  };
  if (existing.length > 0) return (await request("specification_sections", { method: "PATCH", searchParams: { id: `eq.${existing[0].id}` }, prefer: "return=representation", body: payload }))[0];
  return (await request("specification_sections", { method: "POST", prefer: "return=representation", body: payload }))[0];
}

async function ensureSubmittalDocLink() {
  const existing = await request("submittal_doc_links", {
    searchParams: {
      select: "submittal_id,document_metadata_id",
      submittal_id: `eq.${SUBMITTAL_ID}`,
      document_metadata_id: `eq.${PRODUCT_DOCUMENT_ID}`,
      limit: "1",
    },
  });

  if (existing.length > 0) return existing;

  return request("submittal_doc_links", {
    method: "POST",
    prefer: "return=representation",
    body: {
      submittal_id: SUBMITTAL_ID,
      document_metadata_id: PRODUCT_DOCUMENT_ID,
      document_type: "submittal",
      attached_by: null,
    },
  });
}

async function main() {
  await upsertById("document_metadata", PRODUCT_DOCUMENT_ID, {
    title: "Synthetic Storefront Product Data - 08-43-13",
    file_name: "Synthetic_Storefront_Product_Data_08-43-13.txt",
    type: "text/plain",
    document_type: "submittal",
    category: "submittal",
    source_system: "synthetic_test",
    source: "synthetic_quality_fixture",
    status: "complete",
    phase: "Current",
    project_id: PROJECT_ID,
    content: PRODUCT_CONTENT,
    raw_text: PRODUCT_CONTENT,
    source_metadata: {
      synthetic_test: true,
      fixture: "submittal_ai_quality_fixture",
      intentional_mismatch: "finish is dark bronze; spec requires clear anodized",
    },
  });

  const specificationSection = await upsertSpecificationSection();

  await ensureSubmittalDocLink();

  await request("submittals", {
    method: "PATCH",
    searchParams: { id: `eq.${SUBMITTAL_ID}` },
    prefer: "return=representation",
    body: {
      specification_section_id: specificationSection.id,
      specification_section: "08-43-13",
      description:
        "Synthetic AI review quality proof with checkable storefront product data, A201 coordination references, and one intentional finish mismatch.",
      metadata: {
        synthetic_test: true,
        synthetic_test_owner: "codex",
        synthetic_test_reason: "AI submittal review quality proof",
        linked_drawing_id: "4a041968-6862-41de-95da-f104a39d1172",
        linked_document_id: "016591c2-f062-4127-b353-9cf3750dadd3",
        product_document_id: PRODUCT_DOCUMENT_ID,
        synthetic_specification_section_id: specificationSection.id,
        intentional_mismatch: "finish",
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: PROJECT_ID,
        submittalId: SUBMITTAL_ID,
        productDocumentId: PRODUCT_DOCUMENT_ID,
        specificationId: SPECIFICATION_ID,
        expectedReviewSignal:
          "Performance/product data should be checkable; finish should conflict.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
