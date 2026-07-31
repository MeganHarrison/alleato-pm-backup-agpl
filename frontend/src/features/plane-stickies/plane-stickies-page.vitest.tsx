import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlaneStickiesApi } from "./plane-stickies-api";
import type { PlaneSticky } from "./plane-stickies-contract";
import { orderPlaneStickies, PlaneStickiesPage } from "./plane-stickies-page";

const sticky = (overrides: Partial<PlaneSticky> = {}): PlaneSticky => ({
  id: "22222222-2222-4222-8222-222222222222",
  owner_id: "11111111-1111-4111-8111-111111111111",
  workspace_key: "alleato",
  scope: "project",
  project_id: 31,
  content: "Coordinate the next release",
  background_color: "gray",
  sort_order: 20,
  is_pinned: false,
  archived_at: null,
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T13:00:00.000Z",
  ...overrides,
});

function api(overrides: Partial<PlaneStickiesApi> = {}): PlaneStickiesApi {
  return {
    list: vi.fn(async () => [sticky()]),
    create: vi.fn(async () => sticky()),
    update: vi.fn(async () => sticky()),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("Plane Stickies page", () => {
  it("orders pinned notes before the remaining deterministic sequence", () => {
    const result = orderPlaneStickies([
      sticky({
        id: "33333333-3333-4333-8333-333333333333",
        sort_order: 1,
      }),
      sticky({
        id: "44444444-4444-4444-8444-444444444444",
        is_pinned: true,
        sort_order: 99,
      }),
      sticky({
        id: "55555555-5555-4555-8555-555555555555",
        sort_order: 2,
      }),
    ]);
    expect(result.map((item) => item.id)).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333",
      "55555555-5555-4555-8555-555555555555",
    ]);
  });

  it("renders the Plane header, project scope, and sticky content", async () => {
    const client = api();
    render(<PlaneStickiesPage projectId={31} api={client} />);

    expect(screen.getByText("Stickies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project" })).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue("Coordinate the next release"),
    ).toBeInTheDocument();
    expect(client.list).toHaveBeenCalledWith({
      workspaceKey: "alleato",
      scope: "project",
      projectId: 31,
      archived: false,
    });
  });

  it("fails loudly with one retry action when the migration is pending", async () => {
    const client = api({
      list: vi.fn(async () => {
        throw new Error(
          "Stickies are unavailable until the Plane Stickies database migration is applied.",
        );
      }),
    });
    render(<PlaneStickiesPage projectId={31} api={client} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Stickies are unavailable until the Plane Stickies database migration is applied.",
    );
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(1);
  });

  it("rolls back a failed optimistic create and keeps the error visible", async () => {
    const client = api({
      list: vi.fn(async () => []),
      create: vi.fn(async () => {
        throw new Error("Could not create the sticky.");
      }),
    });
    render(<PlaneStickiesPage projectId={31} api={client} />);
    await screen.findByText("Create your first sticky");

    fireEvent.click(screen.getAllByRole("button", { name: /Add sticky/i })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the sticky.",
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Sticky content")).not.toBeInTheDocument(),
    );
  });

  it("keeps an optimistic sticky read-only until the server assigns its id", async () => {
    let resolveCreate: ((value: PlaneSticky) => void) | undefined;
    const createPromise = new Promise<PlaneSticky>((resolve) => {
      resolveCreate = resolve;
    });
    const client = api({
      list: vi.fn(async () => []),
      create: vi.fn(() => createPromise),
    });
    render(<PlaneStickiesPage projectId={31} api={client} />);
    await screen.findByText("Create your first sticky");

    fireEvent.click(screen.getAllByRole("button", { name: /Add sticky/i })[0]);

    expect(await screen.findByLabelText("Sticky content")).toBeDisabled();
    resolveCreate?.(sticky());
    await waitFor(() =>
      expect(screen.getByLabelText("Sticky content")).toBeEnabled(),
    );
  });

  it("ignores a stale list response after the scope changes", async () => {
    let resolveProject: ((value: PlaneSticky[]) => void) | undefined;
    const projectPromise = new Promise<PlaneSticky[]>((resolve) => {
      resolveProject = resolve;
    });
    const client = api({
      list: vi.fn(({ scope }) =>
        scope === "project"
          ? projectPromise
          : Promise.resolve([
              sticky({
                scope: "workspace",
                project_id: null,
                content: "Workspace note wins",
              }),
            ]),
      ),
    });
    render(<PlaneStickiesPage projectId={31} api={client} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(
      await screen.findByDisplayValue("Workspace note wins"),
    ).toBeInTheDocument();

    resolveProject?.([sticky({ content: "Stale project note" })]);
    await waitFor(() =>
      expect(
        screen.queryByDisplayValue("Stale project note"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Workspace note wins")).toBeInTheDocument();
  });
});
