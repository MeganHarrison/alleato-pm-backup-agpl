export type SpacingProfile =
  | "dashboard"
  | "table"
  | "form"
  | "docs"
  | "executive";

export type DensityProfile = "compact" | "standard" | "comfortable";

type CSSVarMap = Record<string, string>;

const spacingByProfile: Record<SpacingProfile, CSSVarMap> = {
  dashboard: {
    "--page-padding": "1.5rem",
    "--section-gap": "1.5rem",
    "--content-gap": "1rem",
  },
  table: {
    "--page-padding": "1rem",
    "--section-gap": "1rem",
    "--content-gap": "0.75rem",
  },
  form: {
    "--page-padding": "1.5rem",
    "--section-gap": "1.5rem",
    "--content-gap": "1rem",
  },
  docs: {
    "--page-padding": "2rem",
    "--section-gap": "2rem",
    "--content-gap": "1.25rem",
  },
  executive: {
    "--page-padding": "0",
    "--section-gap": "1.5rem",
    "--content-gap": "1rem",
  },
};

const densityByProfile: Record<DensityProfile, CSSVarMap> = {
  compact: {
    "--row-height": "2rem",
    "--control-height": "2rem",
    "--control-padding-x": "0.5rem",
  },
  standard: {
    "--row-height": "2.25rem",
    "--control-height": "2.25rem",
    "--control-padding-x": "0.625rem",
  },
  comfortable: {
    "--row-height": "2.5rem",
    "--control-height": "2.5rem",
    "--control-padding-x": "0.75rem",
  },
};

export function spacingToCSSVars(profile: SpacingProfile): CSSVarMap {
  return spacingByProfile[profile];
}

export function densityToCSSVars(profile: DensityProfile): CSSVarMap {
  return densityByProfile[profile];
}
