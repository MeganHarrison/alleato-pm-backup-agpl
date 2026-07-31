import { detectFmdsDomainRequest } from "../fmds-chat";

describe("detectFmdsDomainRequest", () => {
  it.each([
    "Which FMDS 8-34 table applies to this configuration?",
    "For an ASRS system with standard-coverage sprinklers and 12 design sprinklers, what requirements apply?",
    "Does a 12 ft rack storage arrangement require in-rack sprinklers or vertical barriers?",
    "What hose demand applies to 20 design sprinklers?",
    "Which figure governs transverse flue spaces in rack storage?",
  ])("recognizes FMDS engineering-domain questions: %s", (message) => {
    expect(detectFmdsDomainRequest(message)).toEqual({
      query: message,
      corpus: "FMDS0834",
      revisionMode: "latest_eligible",
    });
  });

  it.each([
    "What is the status of the ASRS Estimator project?",
    "Show me the latest project meeting about ASRS.",
    "How is our FM Global client relationship?",
    "What sprinklers are available at the hardware store?",
    "What is the project storage budget?",
  ])("does not steal non-engineering chat requests: %s", (message) => {
    expect(detectFmdsDomainRequest(message)).toBeNull();
  });
});
