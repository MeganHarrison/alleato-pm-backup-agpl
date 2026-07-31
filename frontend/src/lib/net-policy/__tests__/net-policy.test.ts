import {
  checkUrlEgress,
  redactSensitiveUrl,
  redactSensitiveUrlLikeString,
  isSensitiveUrlQueryParamName,
  stripUrlUserInfo,
  isPrivateOrLoopbackIpAddress,
  isCloudMetadataIpAddress,
} from "@/lib/net-policy";

describe("checkUrlEgress — SSRF gate", () => {
  const blocked: Array<[string, string]> = [
    ["loopback v4", "http://127.0.0.1/x"],
    ["loopback v6", "http://[::1]/x"],
    ["private 10.x", "http://10.0.0.5/x"],
    ["private 192.168.x", "http://192.168.1.10/x"],
    ["private 172.16.x", "http://172.16.0.1/x"],
    ["link-local", "http://169.254.1.1/x"],
    ["aws/gcp metadata", "http://169.254.169.254/latest/meta-data/"],
    ["aliyun metadata", "http://100.100.100.200/x"],
    ["gcp metadata v6", "http://[fd00:ec2::254]/x"],
    ["unique-local v6", "http://[fd12:3456:789a::1]/x"],
    ["octal-encoded loopback", "http://0177.0.0.1/x"],
    ["ipv4-mapped loopback", "http://[::ffff:127.0.0.1]/x"],
  ];

  it.each(blocked)("blocks %s", (_label, url) => {
    const verdict = checkUrlEgress(url);
    expect(verdict.allowed).toBe(false);
  });

  const allowed: Array<[string, string]> = [
    ["public domain", "https://api.openai.com/v1/chat"],
    ["render backend", "https://alleato-backend-rbnj.onrender.com/api/foo"],
    ["supabase", "https://lgveqfnpkxvzbnnwuled.supabase.co/rest/v1/x"],
    ["public IP", "http://8.8.8.8/x"],
    ["localhost by name (not an IP literal)", "http://localhost:8000/x"],
  ];

  it.each(allowed)("allows %s", (_label, url) => {
    expect(checkUrlEgress(url).allowed).toBe(true);
  });

  it("allows a private host only when allowPrivateHosts is set", () => {
    expect(checkUrlEgress("http://10.0.0.5/x").allowed).toBe(false);
    expect(checkUrlEgress("http://10.0.0.5/x", { allowPrivateHosts: true }).allowed).toBe(true);
  });

  it("always blocks cloud-metadata IPs even with allowPrivateHosts", () => {
    // The metadata guard fires before the allowPrivateHosts escape hatch.
    expect(checkUrlEgress("http://169.254.169.254/", { allowPrivateHosts: true }).allowed).toBe(
      false,
    );
    expect(checkUrlEgress("http://100.100.100.200/", { allowPrivateHosts: true }).allowed).toBe(
      false,
    );
    expect(checkUrlEgress("http://[fd00:ec2::254]/", { allowPrivateHosts: true }).allowed).toBe(
      false,
    );
  });

  it("does not throw on an unparseable URL (defers to downstream fetch)", () => {
    expect(checkUrlEgress("not a url").allowed).toBe(true);
  });

  it("surfaces a reason and host on block", () => {
    const verdict = checkUrlEgress("http://10.0.0.5/x");
    if (verdict.allowed) throw new Error("expected blocked");
    expect(verdict.host).toBe("10.0.0.5");
    expect(verdict.reason).toMatch(/private|special/i);
  });
});

describe("IP classification primitives", () => {
  it("isPrivateOrLoopbackIpAddress", () => {
    expect(isPrivateOrLoopbackIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIpAddress("10.1.2.3")).toBe(true);
    expect(isPrivateOrLoopbackIpAddress("8.8.8.8")).toBe(false);
  });
  it("isCloudMetadataIpAddress", () => {
    expect(isCloudMetadataIpAddress("100.100.100.200")).toBe(true);
    expect(isCloudMetadataIpAddress("8.8.8.8")).toBe(false);
  });
});

describe("redactSensitiveUrl", () => {
  it("redacts userinfo credentials", () => {
    expect(redactSensitiveUrl("https://user:secretpass@example.com/x")).toBe(
      "https://***:***@example.com/x",
    );
  });

  it("redacts sensitive query params, keeps benign ones", () => {
    const out = redactSensitiveUrl("https://example.com/x?token=abc123&page=2&api_key=zzz");
    expect(out).toContain("token=***");
    expect(out).toContain("api_key=***");
    expect(out).toContain("page=2");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("zzz");
  });

  it("leaves a clean URL unchanged", () => {
    const url = "https://example.com/x?page=2";
    expect(redactSensitiveUrl(url)).toBe(url);
  });

  it("returns non-URL strings unchanged", () => {
    expect(redactSensitiveUrl("not a url")).toBe("not a url");
  });

  it("redactSensitiveUrlLikeString redacts inside non-URL text", () => {
    expect(redactSensitiveUrlLikeString("call ?access_token=leak now")).toContain(
      "access_token=***",
    );
  });
});

describe("isSensitiveUrlQueryParamName", () => {
  it.each(["token", "api_key", "apikey", "ACCESS_TOKEN", "client-secret", "jwt"])(
    "flags %s",
    (name) => {
      expect(isSensitiveUrlQueryParamName(name)).toBe(true);
    },
  );
  it.each(["page", "limit", "q", "id"])("does not flag %s", (name) => {
    expect(isSensitiveUrlQueryParamName(name)).toBe(false);
  });
});

describe("stripUrlUserInfo", () => {
  it("strips credentials", () => {
    expect(stripUrlUserInfo("https://u:p@example.com/x")).toBe("https://example.com/x");
  });
  it("leaves a credential-free URL unchanged", () => {
    expect(stripUrlUserInfo("https://example.com/x")).toBe("https://example.com/x");
  });
});
