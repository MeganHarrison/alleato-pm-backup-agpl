/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import AskTrainingLibraryPage from "../page";

const ragChatPage = jest.fn(() => <div>Training chat</div>);

jest.mock("@/components/ai-assistant/rag-chat-page", () => ({
  RagChatPage: (props: unknown) => ragChatPage(props),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({
    title,
    tabs,
    actions,
    className,
    children,
  }: {
    title: string;
    tabs?: { label: string; href: string }[];
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
  }) => (
    <main className={className}>
      <h1>{title}</h1>
      {tabs?.length ? (
        <nav>
          {tabs.map((tab) => (
            <a key={tab.href} href={tab.href}>
              {tab.label}
            </a>
          ))}
        </nav>
      ) : null}
      {actions}
      {children}
    </main>
  ),
}));

describe("AskTrainingLibraryPage", () => {
  it("uses the shared chat on the isolated training surface", () => {
    render(<AskTrainingLibraryPage />);

    expect(
      screen.getByRole("heading", { name: "Ask the Library" }),
    ).toBeInTheDocument();
    expect(ragChatPage).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "training_library",
        basePath: "/training/ask",
        chatApi: "/api/training/library/chat",
        chatMode: "training",
      }),
    );
  });

  it("does not promote the recovery-only NotebookLM fallback", () => {
    render(<AskTrainingLibraryPage />);

    expect(
      screen.queryByRole("link", { name: /NotebookLM/i }),
    ).not.toBeInTheDocument();
  });

  it("removes the training tab strip and uses the white surface token", () => {
    const { container } = render(<AskTrainingLibraryPage />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector("main")).toHaveClass(
      "[--card:0_0%_100%]",
      "bg-card",
    );
  });
});
