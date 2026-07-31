#!/usr/bin/env node
// UserPromptSubmit hook: when a prompt looks like debugging, inject the
// Debugging Gate iron law into context. Deterministic counterpart to the
// advisory skill/rules layer. Full rule: .claude/rules/DEBUGGING-GATE.md

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let prompt = "";
  try {
    prompt = JSON.parse(raw).prompt ?? "";
  } catch {
    // Not JSON — treat the raw input as the prompt.
    prompt = raw;
  }

  const debugSignals =
    /\b(bug(s|gy)?|broken|breaks?|not work(ing)?|does\s?n[o']?t work|stopped working|won'?t (load|save|render|open|submit)|fail(s|ing|ed|ure)?|error(s|ed)?|exception|regression|debug(ging)?|crash(es|ed|ing)?|why (is|does|isn'?t|doesn'?t|won'?t)|disappear(s|ed|ing)?|undefined|NaN\b|\b4\d\d\b|\b5\d\d\b|stack ?trace|flaky)\b/i;

  if (debugSignals.test(prompt)) {
    process.stdout.write(
      [
        "=== DEBUGGING GATE (auto-injected — .claude/rules/DEBUGGING-GATE.md) ===",
        "This prompt looks like debugging. The Iron Law: NO product-code edit until the",
        "fault is localized to a layer boundary, with the observation that proves it.",
        "1. Observe the RUNNING system (browser tools, logs, DB reads) — never debug by re-reading source.",
        "2. Walk the layers (DB -> API -> client state -> DOM); find the FIRST boundary where",
        "   expected != observed. Everything upstream is provably innocent — stop looking there.",
        "3. Instrument that boundary only (state-vs-DOM -> DOM mutation breakpoint; API-vs-state -> log it).",
        "4. Suspect the environment? Isolation split: minimal context vs full app (~5 min, halves the space).",
        "5. Two failed hypotheses -> stop; list and test your ASSUMPTIONS, not a third guess.",
        "   Three failed fixes -> question the architecture and report.",
        "If the superpowers:systematic-debugging skill is available, invoke it now.",
      ].join("\n") + "\n"
    );
  }
  process.exit(0);
});
