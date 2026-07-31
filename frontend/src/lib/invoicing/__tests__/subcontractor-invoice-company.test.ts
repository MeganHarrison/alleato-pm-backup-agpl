import {
  ALLEATO_GENERAL_CONTRACTOR_COMPANY,
  resolveGeneralContractorCompany,
} from "../subcontractor-invoice-company";

describe("resolveGeneralContractorCompany", () => {
  it("falls back to Alleato Group company information when the project company is missing", () => {
    expect(resolveGeneralContractorCompany(null)).toEqual(
      ALLEATO_GENERAL_CONTRACTOR_COMPANY,
    );
  });

  it("fills blank company fields without overwriting present values", () => {
    expect(
      resolveGeneralContractorCompany({
        name: "Alleato Group LLC",
        address: " ",
        city: "Indianapolis",
        state: "",
        zip_code: null,
      }),
    ).toEqual({
      ...ALLEATO_GENERAL_CONTRACTOR_COMPANY,
      name: "Alleato Group LLC",
      city: "Indianapolis",
    });
  });
});
