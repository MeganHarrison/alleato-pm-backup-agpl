import { shouldLoadPrimeContractPcoFinancialMarkup } from "@/lib/prime-contract-pcos/financial-markup-load";

describe("shouldLoadPrimeContractPcoFinancialMarkup", () => {
  it("does not load while the user is on another tab", () => {
    expect(
      shouldLoadPrimeContractPcoFinancialMarkup({
        projectId: 876,
        activeTab: "general",
        hasLoadedFinancialMarkupData: false,
      }),
    ).toBe(false);
  });

  it("loads once when the financial markup tab opens", () => {
    expect(
      shouldLoadPrimeContractPcoFinancialMarkup({
        projectId: 876,
        activeTab: "financial-markup",
        hasLoadedFinancialMarkupData: false,
      }),
    ).toBe(true);
  });

  it("does not load again after the data has already been fetched", () => {
    expect(
      shouldLoadPrimeContractPcoFinancialMarkup({
        projectId: 876,
        activeTab: "financial-markup",
        hasLoadedFinancialMarkupData: true,
      }),
    ).toBe(false);
  });
});
