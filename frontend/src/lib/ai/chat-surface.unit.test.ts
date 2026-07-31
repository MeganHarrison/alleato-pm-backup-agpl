import {
  assistantSurfaceQuery,
  conversationMatchesSurface,
  parseAssistantSurface,
} from "./chat-surface";

describe("chat surface contract", () => {
  it("treats legacy conversations as general assistant conversations", () => {
    expect(conversationMatchesSurface(null, "alleato_ai")).toBe(true);
    expect(conversationMatchesSurface({}, "alleato_ai")).toBe(true);
  });

  it("binds Ask Alleato conversations to the compact surface", () => {
    const metadata = { surface: "ask_alleato" };
    expect(conversationMatchesSurface(metadata, "ask_alleato")).toBe(true);
    expect(conversationMatchesSurface(metadata, "alleato_ai")).toBe(false);
  });

  it("keeps Ask Alleato conversations out of the general assistant", () => {
    const metadata = { surface: "ask_alleato" };
    expect(conversationMatchesSurface(metadata, "alleato_ai")).toBe(false);
  });

  it("normalizes unknown surface values to the general assistant", () => {
    expect(parseAssistantSurface("asrs")).toBe("alleato_ai");
    expect(parseAssistantSurface("ask_alleato")).toBe("ask_alleato");
    expect(parseAssistantSurface("unknown")).toBe("alleato_ai");
    expect(assistantSurfaceQuery("ask_alleato")).toBe("surface=ask_alleato");
  });
});
