/**
 * Canonical acceptance seam for an Executive Intelligence Run.
 *
 * Writers, schedulers, and monitors must agree on this contract instead of
 * re-implementing a weaker "current packet" predicate at each call site.
 */
export const EXECUTIVE_INTELLIGENCE_COMPILER_VERSION = "manual_daily_executive_brief_v1";
export const EXECUTIVE_INTELLIGENCE_TARGET_SLUG = "daily-executive-brief";

export function runContractFromPacket(packet) {
  return packet?.run_contract ?? packet?.runContract ?? packet?.packet_json?.runContract ?? null;
}

export function publishabilityFailures(packet, { businessDate } = {}) {
  if (!packet) return ["packet is missing"];
  const runContract = runContractFromPacket(packet);
  const failures = [];
  if (packet.compiler_version !== EXECUTIVE_INTELLIGENCE_COMPILER_VERSION) {
    failures.push(`compiler='${packet.compiler_version}' expected='${EXECUTIVE_INTELLIGENCE_COMPILER_VERSION}'`);
  }
  if (packet.packet_type !== "current") failures.push(`packet_type='${packet.packet_type}'`);
  if (packet.freshness_status !== "fresh") failures.push(`freshness_status='${packet.freshness_status}'`);
  if (runContract?.status !== "completed") failures.push(`run_contract.status='${runContract?.status}'`);
  if (businessDate && packet.business_date !== businessDate) {
    failures.push(`business_date='${packet.business_date}' expected='${businessDate}'`);
  }
  return failures;
}

export function assertPublishableRun(packet, options = {}) {
  const failures = publishabilityFailures(packet, options);
  if (failures.length) {
    throw new Error(
      `Packet ${packet?.id ?? "unknown"} is not a completed Executive Intelligence Run: ${failures.join(", ")}.`,
    );
  }
  return packet;
}

export function isPublishableRun(packet, options = {}) {
  return publishabilityFailures(packet, options).length === 0;
}
