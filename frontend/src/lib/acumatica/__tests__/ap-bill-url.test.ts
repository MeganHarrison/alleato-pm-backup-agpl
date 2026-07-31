import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";

describe("buildAcumaticaApBillHref", () => {
  it("builds the Acumatica AP bill screen url with doc type and ref number", () => {
    expect(buildAcumaticaApBillHref("Bill", "002981")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=AP301000&DocType=INV&RefNbr=002981",
    );
  });

  it("defaults the doc type to Bill when it is missing", () => {
    expect(buildAcumaticaApBillHref(null, "002981")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=AP301000&DocType=INV&RefNbr=002981",
    );
  });

  it("encodes special characters in the reference number", () => {
    expect(buildAcumaticaApBillHref("Prepayment", "BILL 12/7")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=AP301000&DocType=Prepayment&RefNbr=BILL%2012%2F7",
    );
  });

  it("maps adjustment labels to Acumatica AP doc type codes", () => {
    expect(buildAcumaticaApBillHref("Debit Adj.", "000123")).toBe(
      "https://alleatogroup.acumatica.com/Main?ScreenId=AP301000&DocType=ADR&RefNbr=000123",
    );
  });
});
