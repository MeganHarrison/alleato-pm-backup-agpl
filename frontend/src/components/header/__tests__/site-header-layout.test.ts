import {
  SITE_HEADER_DESKTOP_MIN_WIDTH,
  shouldUseCompactSiteHeader,
} from "../site-header-layout";

describe("site header responsive fallback", () => {
  it("uses compact mode below the desktop minimum width", () => {
    expect(
      shouldUseCompactSiteHeader(SITE_HEADER_DESKTOP_MIN_WIDTH - 1),
    ).toBe(true);
  });

  it("keeps desktop mode at or above the desktop minimum width", () => {
    expect(
      shouldUseCompactSiteHeader(SITE_HEADER_DESKTOP_MIN_WIDTH),
    ).toBe(false);
    expect(
      shouldUseCompactSiteHeader(SITE_HEADER_DESKTOP_MIN_WIDTH + 120),
    ).toBe(false);
  });
});
