import { GuardrailError } from "@/lib/guardrails/errors";
import { throwScheduleRpcError } from "@/lib/scheduling/schedule-route-errors";

function captureRpcError(code: string): GuardrailError {
  try {
    throwScheduleRpcError("schedule-test", { code, message: "RPC failed" });
  } catch (error) {
    expect(error).toBeInstanceOf(GuardrailError);
    return error as GuardrailError;
  }
}

it.each(["22001", "22003", "22007", "22023", "23503", "23514", "54000"])(
  "maps expected client-caused SQLSTATE %s to a structured 400",
  (code) => {
    const error = captureRpcError(code);

    expect(error.code).toBe("INVALID_PAYLOAD");
    expect(error.status).toBe(400);
  },
);

it.each(["40001", "PT409"])(
  "maps stale capacity versions from %s to a structured 409",
  (code) => {
    const error = captureRpcError(code);

    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.status).toBe(409);
  },
);

it("maps unexpected snapshot-integrity failures to an alertable 500", () => {
  const error = captureRpcError("55000");

  expect(error.code).toBe("DB_ERROR");
  expect(error.status).toBe(500);
  expect(error.cause).toEqual({ code: "55000", message: "RPC failed" });
});
