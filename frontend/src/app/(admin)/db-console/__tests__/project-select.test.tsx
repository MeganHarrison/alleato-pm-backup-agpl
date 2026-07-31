/** @jest-environment jsdom */

/**
 * Guardrail: the project picker shows its selected label on FIRST paint.
 *
 * A bare `<SelectValue />` renders nothing of its own — Radix mounts the closed
 * `SelectContent` into a detached DocumentFragment and portals the selected
 * item's text into the trigger. That side-channel is asynchronous, so the
 * trigger can paint empty even though `value` is set (observed live on
 * /db-console 2026-07-30: trigger text "", no `data-placeholder` attribute).
 * Passing the label as children renders it in the same pass as the value.
 */

import { render, screen } from "@testing-library/react";

// The page pulls in the Supabase Manager dialog, which imports react-markdown
// (ESM, untransformed by ts-jest). Stub it — this test is about the trigger.
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: () => null,
}));

import DbConsolePage from "@/app/(admin)/db-console/page";

describe("/db-console project picker", () => {
  it("renders the selected project label in the trigger on first paint", () => {
    const { container } = render(<DbConsolePage />);

    const trigger = container.querySelector('[data-slot="select-trigger"]');
    expect(trigger).not.toBeNull();
    // Synchronous assertion, before any effect/portal has had a chance to run.
    expect(trigger).toHaveTextContent("PM App (primary database)");
  });

  it("names the combobox and shows the selected project as its visible text", () => {
    render(<DbConsolePage />);

    // A combobox's accessible name comes from its label, never its contents,
    // so the trigger carries an explicit one; the selection is the visible text.
    const combobox = screen.getByRole("combobox", { name: /project/i });
    expect(combobox).toHaveTextContent("PM App (primary database)");
  });
});
