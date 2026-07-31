import { buildAcumaticaProjectHref } from "@/lib/acumatica/project-url";

describe("buildAcumaticaProjectHref", () => {
  it("builds the Acumatica project record URL", () => {
    expect(buildAcumaticaProjectHref("24-101")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=PM301000&ProjectID=24-101",
    );
  });

  it("trims and encodes the project identifier", () => {
    expect(buildAcumaticaProjectHref(" Project 12/7 ")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=PM301000&ProjectID=Project%2012%2F7",
    );
  });
});
