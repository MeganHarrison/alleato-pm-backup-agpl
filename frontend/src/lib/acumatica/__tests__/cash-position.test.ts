import { AcumaticaClient } from "../client";

describe("AcumaticaClient.getCashPosition", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("uses the provider-supported ApplicationDate field for AR and AP cash activity", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-31T12:00:00.000Z"));

    const client = new AcumaticaClient();
    const paymentsSpy = jest.spyOn(client, "getPayments").mockResolvedValue([
      {
        ReferenceNbr: "PAY-1",
        ApplicationDate: "2026-07-15T00:00:00.000Z",
        Status: "Open",
        PaymentAmount: 1250,
      },
      {
        ReferenceNbr: "PAY-OLD",
        ApplicationDate: "2026-01-01T00:00:00.000Z",
        Status: "Closed",
        PaymentAmount: 9000,
      },
    ]);
    const checksSpy = jest.spyOn(client, "getChecks").mockResolvedValue([
      {
        ReferenceNbr: "CHK-1",
        ApplicationDate: "2026-07-20T00:00:00.000Z",
        Status: "Open",
        PaymentAmount: 400,
      },
    ]);

    await expect(client.getCashPosition(90)).resolves.toMatchObject({
      totalInflows: 1250,
      totalOutflows: 400,
      netCashFlow: 850,
      windowDays: 90,
    });

    const providerSelect =
      "ReferenceNbr,ApplicationDate,PaymentAmount,Status";
    expect(paymentsSpy).toHaveBeenCalledWith({
      $top: 500,
      $select: providerSelect,
    });
    expect(checksSpy).toHaveBeenCalledWith({
      $top: 500,
      $select: providerSelect,
    });
  });
});
