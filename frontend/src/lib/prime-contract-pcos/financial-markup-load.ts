export function shouldLoadPrimeContractPcoFinancialMarkup(options: {
  projectId: number;
  activeTab: string;
  hasLoadedFinancialMarkupData: boolean;
}): boolean {
  return (
    Number.isFinite(options.projectId) &&
    options.projectId > 0 &&
    options.activeTab === "financial-markup" &&
    !options.hasLoadedFinancialMarkupData
  );
}
