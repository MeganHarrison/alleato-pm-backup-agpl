/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  getTrainingDocFocus,
  TrainingDocExperience,
} from "../training-doc-experience";
import type { TrainingDocStep } from "@/lib/training-docs/types";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function step({
  id,
  title,
  focus = { x: 0.2, y: 0.3, width: 0.3, height: 0.2 },
}: {
  id: string;
  title: string;
  focus?: Record<string, unknown> | null;
}): TrainingDocStep {
  return {
    id,
    training_doc_id: "doc-1",
    screenshot_asset_id: `asset-${id}`,
    created_by: null,
    step_order: Number(id),
    title,
    instruction_markdown: `Complete ${title}.`,
    expected_result: `${title} is complete.`,
    source_url: null,
    action_metadata: focus ? { focus } : {},
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    screenshot_asset: {
      id: `asset-${id}`,
      training_doc_id: "doc-1",
      storage_bucket: "training-docs",
      storage_path: `prime-contract/${id}.png`,
      file_name: `${title}.png`,
      mime_type: "image/png",
      asset_type: "screenshot",
      caption: null,
      alt_text: `${title} screenshot`,
      step_order: Number(id),
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
      signed_url: `https://example.test/${id}.png`,
    },
  };
}

describe("getTrainingDocFocus", () => {
  it("accepts a normalized capture-derived rectangle", () => {
    expect(
      getTrainingDocFocus({ focus: { x: 0.61, y: 0.29, width: 0.24, height: 0.08 } }),
    ).toEqual({ x: 0.61, y: 0.29, width: 0.24, height: 0.08 });
  });

  it.each([
    {},
    { focus: { x: 0.8, y: 0.2, width: 0.3, height: 0.2 } },
    { focus: { x: 0.2, y: 0.3, width: 0, height: 0.2 } },
    { focus: { x: "0.2", y: 0.3, width: 0.2, height: 0.2 } },
  ])("rejects malformed focus metadata %#", (metadata) => {
    expect(getTrainingDocFocus(metadata)).toBeNull();
  });
});

describe("TrainingDocExperience", () => {
  const steps = [step({ id: "1", title: "Open the contract form" }), step({ id: "2", title: "Set the lifecycle status" })];

  it("selects an annotated screenshot and explanation together", () => {
    render(
      <TrainingDocExperience
        articleHref="/knowledge/app/prime-contracts/create-a-prime-contract"
        mode="annotated"
        steps={steps}
      />,
    );

    expect(screen.getByAltText("Open the contract form screenshot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /set the lifecycle status/i }));
    expect(screen.getByAltText("Set the lifecycle status screenshot")).toBeInTheDocument();
    expect(screen.getByText("Complete Set the lifecycle status.")).toBeInTheDocument();
  });

  it("advances Guide me with synchronized progress and keyboard controls", () => {
    jest.useFakeTimers();
    render(
      <TrainingDocExperience
        articleHref="/knowledge/app/prime-contracts/create-a-prime-contract"
        mode="walkthrough"
        steps={steps}
      />,
    );

    const walkthrough = screen.getByRole("region", { name: "Guide me walkthrough" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    fireEvent.keyDown(walkthrough, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    act(() => jest.advanceTimersByTime(150));

    expect(screen.getByAltText("Set the lifecycle status screenshot")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    jest.useRealTimers();
  });

  it("fails loudly to the article when a screenshot lacks verified focus geometry", () => {
    render(
      <TrainingDocExperience
        articleHref="/knowledge/app/prime-contracts/create-a-prime-contract"
        mode="walkthrough"
        steps={[step({ id: "1", title: "Open the contract form" }), step({ id: "2", title: "Missing focus", focus: null })]}
      />,
    );

    expect(screen.getByText("Guide me unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open article view" })).toHaveAttribute(
      "href",
      "/knowledge/app/prime-contracts/create-a-prime-contract",
    );
  });
});
