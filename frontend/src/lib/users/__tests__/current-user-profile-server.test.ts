import { resolveCurrentUserAvatarUrl } from "../current-user-profile-server";

describe("resolveCurrentUserAvatarUrl", () => {
  it("keeps the directory photo as the canonical avatar", () => {
    expect(
      resolveCurrentUserAvatarUrl(" https://cdn.example.com/directory.jpg ", {
        avatar_url: "https://cdn.example.com/auth.jpg",
      }),
    ).toBe("https://cdn.example.com/directory.jpg");
  });

  it("uses the authenticated user image when the directory has none", () => {
    expect(
      resolveCurrentUserAvatarUrl(null, {
        avatar_url: "https://cdn.example.com/auth.jpg",
      }),
    ).toBe("https://cdn.example.com/auth.jpg");
  });

  it("supports provider picture metadata before falling back to Gravatar", () => {
    expect(
      resolveCurrentUserAvatarUrl(undefined, {
        picture: "https://cdn.example.com/provider.jpg",
      }),
    ).toBe("https://cdn.example.com/provider.jpg");
  });
});
