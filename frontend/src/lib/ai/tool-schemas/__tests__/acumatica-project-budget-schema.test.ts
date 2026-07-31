import { getAcumaticaProjectBudgetInputSchema } from "../acumatica-schemas";

it("keeps the external Acumatica project code distinct from Alleato projectId", () => {
  expect(
    getAcumaticaProjectBudgetInputSchema.parse({
      acumaticaProjectId: "25108",
    }),
  ).toEqual({
    acumaticaProjectId: "25108",
    typeFilter: "all",
  });
  expect(() =>
    getAcumaticaProjectBudgetInputSchema.parse({ projectId: "25108" }),
  ).toThrow();
});
