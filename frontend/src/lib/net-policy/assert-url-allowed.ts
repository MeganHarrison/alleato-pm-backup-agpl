/**
 * SSRF egress gate for outbound HTTP.
 *
 * Alleato-authored glue on top of the vendored OpenClaw net-policy IP classifier.
 * Refuses requests whose URL host resolves to a literal private / loopback /
 * link-local / reserved / cloud-metadata IP address — the canonical SSRF vector
 * where a user- or model-supplied URL tricks our server into reaching an
 * internal endpoint (e.g. the cloud metadata service that holds our credentials).
 *
 * It defends against the common bypasses: IPv4-mapped/transition IPv6
 * (`::ffff:127.0.0.1`, 6to4, Teredo, NAT64) is normalized to its embedded IPv4
 * before classification, and obfuscated legacy IPv4 literals (octal/hex/decimal,
 * e.g. `0177.0.0.1`) are refused outright.
 *
 * Scope note: this checks the URL host *as written*. It does NOT resolve DNS,
 * so a domain that resolves to a private IP (DNS-rebinding) is not caught here.
 * That is a deliberate, documented follow-up — the literal-IP check is
 * zero-false-positive for our known public services and never blocks
 * hostname-by-name calls (including `localhost` in local dev).
 */
import {
  extractEmbeddedIpv4FromIpv6,
  isBlockedSpecialUseIpv4Address,
  isBlockedSpecialUseIpv6Address,
  isCloudMetadataIpAddress,
  isIpv4Address,
  isIpv6Address,
  isLegacyIpv4Literal,
  normalizeIpAddress,
  parseLooseIpAddress,
  type Ipv6SpecialUseBlockOptions,
} from "./ip";

export interface UrlEgressPolicy {
  /**
   * When true, do not block private/internal IP literals. Use only for an
   * intentional internal call. Defaults to false (block). Cloud-metadata IPs
   * are blocked regardless of this flag.
   */
  allowPrivateHosts?: boolean;
  /** Exempt the IPv6 Unique Local Address block (fc00::/7) — proxy stacks only. */
  allowUniqueLocalRange?: boolean;
}

export type UrlEgressVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; host: string };

// Always blocked, even with allowPrivateHosts: link-local AWS/GCP/Azure metadata
// (169.254.169.254), Aliyun (100.100.100.200), and the GCP IPv6 metadata host.
// These have no legitimate egress use and are the highest-value SSRF targets.
const ALWAYS_BLOCKED_METADATA_IPS = new Set([
  "169.254.169.254",
  "100.100.100.200",
  "fd00:ec2::254",
]);

function hostnameFromUrl(url: string | URL): string | undefined {
  try {
    const hostname = (url instanceof URL ? url : new URL(url)).hostname;
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

function isAlwaysBlockedMetadata(hostname: string): boolean {
  if (isCloudMetadataIpAddress(hostname)) {
    return true;
  }
  const normalized = normalizeIpAddress(hostname);
  return normalized !== undefined && ALWAYS_BLOCKED_METADATA_IPS.has(normalized);
}

/**
 * Classifies a URL against the egress policy. Returns a verdict instead of
 * throwing so callers can decide how to surface a block.
 */
export function checkUrlEgress(url: string | URL, policy: UrlEgressPolicy = {}): UrlEgressVerdict {
  const hostname = hostnameFromUrl(url);
  if (!hostname) {
    // Unparseable URL — let the downstream fetch throw its own clear error.
    return { allowed: true };
  }

  // Metadata endpoints are blocked first, before the allowPrivateHosts escape.
  if (isAlwaysBlockedMetadata(hostname)) {
    return { allowed: false, reason: "cloud-metadata IP", host: hostname };
  }

  // Obfuscated legacy IPv4 literals (octal/hex/decimal) have no legitimate use
  // and are a classic block-list bypass — refuse them unless explicitly allowed.
  if (isLegacyIpv4Literal(hostname) && policy.allowPrivateHosts !== true) {
    return { allowed: false, reason: "obfuscated legacy IPv4 literal", host: hostname };
  }

  if (policy.allowPrivateHosts === true) {
    return { allowed: true };
  }

  const parsed = parseLooseIpAddress(hostname);
  if (!parsed) {
    // Hostname is a domain name (or "localhost"), not an IP literal — allow.
    return { allowed: true };
  }

  // Normalize IPv4-mapped / transition IPv6 down to its embedded IPv4 so an
  // attacker can't smuggle 127.0.0.1 as ::ffff:127.0.0.1 or via 6to4/NAT64.
  const embeddedV4 = isIpv6Address(parsed) ? extractEmbeddedIpv4FromIpv6(parsed) : undefined;
  const v4 = isIpv4Address(parsed) ? parsed : embeddedV4;
  if (v4) {
    if (isBlockedSpecialUseIpv4Address(v4)) {
      return { allowed: false, reason: "private/special-use IPv4", host: hostname };
    }
    return { allowed: true };
  }

  const ipv6Options: Ipv6SpecialUseBlockOptions = {
    allowUniqueLocalRange: policy.allowUniqueLocalRange === true,
  };
  if (isIpv6Address(parsed) && isBlockedSpecialUseIpv6Address(parsed, ipv6Options)) {
    return { allowed: false, reason: "private/special-use IPv6", host: hostname };
  }
  return { allowed: true };
}
