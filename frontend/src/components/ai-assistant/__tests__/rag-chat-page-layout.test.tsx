import fs from "node:fs";
import path from "node:path";

const ragChatPagePath = path.join(
  process.cwd(),
  "src/components/ai-assistant/rag-chat-page.tsx",
);
const conversationSidebarPath = path.join(
  process.cwd(),
  "src/components/ai-assistant/conversation-sidebar.tsx",
);
const mainLayoutPath = path.join(process.cwd(), "src/app/(main)/layout.tsx");

describe("RagChatPage workspace layout", () => {
  it("keeps the chat surface in the full-height flex chain", () => {
    const source = fs.readFileSync(ragChatPagePath, "utf8");

    expect(source).toContain(
      'className="relative flex h-full min-h-0 w-full min-w-0 flex-1 bg-background"',
    );
    expect(source).toContain('<div className="min-h-0 min-w-0 flex-1">');
  });

  it("keeps the app shell and collapses chat history by default", () => {
    const ragChatPage = fs.readFileSync(ragChatPagePath, "utf8");
    const sidebar = fs.readFileSync(conversationSidebarPath, "utf8");
    const mainLayout = fs.readFileSync(mainLayoutPath, "utf8");

    expect(ragChatPage).toContain(
      "const [historyOpen, setHistoryOpen] = useState(false);",
    );
    expect(ragChatPage).toContain(
      'window.addEventListener("keydown", closeHistoryOnEscape);',
    );
    expect(sidebar).toContain('data-testid="conversation-sidebar-desktop"');
    expect(sidebar).toContain("desktopDocked && open");
    expect(sidebar).toContain("(isMobile || !desktopDocked) && open");
    expect(sidebar).toContain("md:flex");
    expect(sidebar).toContain("md:hidden");
    expect(mainLayout).not.toContain('const isAiWorkspace = pathname === "/ai";');
    expect(mainLayout).not.toContain("if (isAiWorkspace) {");
    expect(mainLayout).toContain(
      '{!isDrawingViewer && <AppSidebar key="app-sidebar" />}',
    );
    expect(mainLayout).toContain("<SiteHeader />");
  });

  it("does not persist an empty conversation when starting a new chat", () => {
    const source = fs.readFileSync(ragChatPagePath, "utf8");
    const handleNewChat = source.slice(
      source.indexOf("const handleNewChat = useCallback"),
      source.indexOf("const handleSelectConversation = useCallback"),
    );

    expect(handleNewChat).toContain("if (createConversation.isPending) return");
    expect(handleNewChat).toContain("setActiveSession(null)");
    expect(handleNewChat).not.toContain("createConversation.mutateAsync");
    expect(handleNewChat).not.toContain('"New conversation"');
    expect(source).toContain(
      "isNewChatDisabled={createConversation.isPending}",
    );
  });
});
