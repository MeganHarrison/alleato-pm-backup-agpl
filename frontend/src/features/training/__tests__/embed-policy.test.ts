import { resolveTrainingEmbed } from "../embed-policy";

describe("resolveTrainingEmbed", () => {
  it("converts an approved YouTube playlist into an on-page player", () => {
    expect(
      resolveTrainingEmbed(
        "https://www.youtube.com/playlist?list=PL-MQNpO8Wb7A_xR5lxspavDGgvGdoqeIu",
      ),
    ).toEqual({
      provider: "youtube",
      url: "https://www.youtube-nocookie.com/embed/videoseries?list=PL-MQNpO8Wb7A_xR5lxspavDGgvGdoqeIu&enablejsapi=1",
    });
  });

  it("rejects an unapproved player host", () => {
    expect(
      resolveTrainingEmbed("https://untrusted.example/embed/video"),
    ).toBeNull();
  });
});
