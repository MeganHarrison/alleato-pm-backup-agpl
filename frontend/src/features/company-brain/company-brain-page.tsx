import { parseBrainRange, type BrainDataState } from "./company-brain-contract";
import { loadCompanyBrainOverview } from "./company-brain-data";
import { CompanyBrainExperience } from "./company-brain-experience";
import { buildCompanyBrainFixture } from "./company-brain-fixture";
import { requireBrainUser } from "@/features/brain/brain-data";

export type CompanyBrainSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

/**
 * Canonical server boundary for Company Brain. Both entry routes reuse this
 * loader so permission checks, live data, fixtures, and failure states cannot
 * drift between the AI workspace and the direct Company Brain route.
 */
export async function CompanyBrainPageContent({
  searchParams,
}: {
  searchParams: CompanyBrainSearchParams;
}) {
  await requireBrainUser();
  const params = await searchParams;
  const range = parseBrainRange(params.range);
  const fixturesEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.COMPANY_BRAIN_TEST_FIXTURES === "1";
  const fixtureState =
    fixturesEnabled &&
    typeof params.fixture === "string" &&
    ["ready", "empty", "partial", "error", "permission_limited"].includes(
      params.fixture,
    )
      ? (params.fixture as BrainDataState)
      : null;
  const overview = fixtureState
    ? buildCompanyBrainFixture(fixtureState)
    : await loadCompanyBrainOverview(range);

  return <CompanyBrainExperience initialOverview={overview} range={range} />;
}
