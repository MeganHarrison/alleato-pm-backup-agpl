import { resolveInitialTeamChatChannelId } from "../team-chat-routing";

describe("team-chat routing", () => {
  it("prefers the comments inbox when a discussion deep link is present", () => {
    expect(
      resolveInitialTeamChatChannelId(
        [
          {
            id: "general",
            name: "General",
            topic: "",
            team: "Team Chat",
            section: "channels",
            unread: 0,
            memberCount: 0,
            preview: "",
            lastMessageAt: null,
            deletable: false,
          },
          {
            id: "comments-inbox",
            name: "Comments inbox",
            topic: "Recent Velt page comments",
            team: "Comments",
            section: "dm",
            unread: 0,
            memberCount: 1,
            preview: "",
            lastMessageAt: null,
            deletable: false,
            isDm: true,
            source: "comments",
            readOnly: true,
            dmPartnerId: null,
            dmPartnerName: null,
          },
        ],
        "general",
        "annotation-1",
      ),
    ).toBe("comments-inbox");
  });

  it("falls back to the active channel when the discussion link is absent", () => {
    expect(
      resolveInitialTeamChatChannelId(
        [
          {
            id: "general",
            name: "General",
            topic: "",
            team: "Team Chat",
            section: "channels",
            unread: 0,
            memberCount: 0,
            preview: "",
            lastMessageAt: null,
            deletable: false,
          },
        ],
        "general",
        null,
      ),
    ).toBe("general");
  });
});
