type CompanyIdentity = {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

export const ALLEATO_GENERAL_CONTRACTOR_COMPANY: CompanyIdentity = {
  name: "Alleato Group",
  address: "8383 Craig Street, Suite 150",
  city: "Indianapolis",
  state: "IN",
  zip_code: "46250",
};

function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveGeneralContractorCompany(
  company: Partial<CompanyIdentity> | null | undefined,
): CompanyIdentity {
  return {
    name: nonBlank(company?.name) ?? ALLEATO_GENERAL_CONTRACTOR_COMPANY.name,
    address:
      nonBlank(company?.address) ?? ALLEATO_GENERAL_CONTRACTOR_COMPANY.address,
    city: nonBlank(company?.city) ?? ALLEATO_GENERAL_CONTRACTOR_COMPANY.city,
    state: nonBlank(company?.state) ?? ALLEATO_GENERAL_CONTRACTOR_COMPANY.state,
    zip_code:
      nonBlank(company?.zip_code) ?? ALLEATO_GENERAL_CONTRACTOR_COMPANY.zip_code,
  };
}
