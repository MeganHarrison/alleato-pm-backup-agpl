/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SchemaExplorerDescriptionCell } from "../schema-explorer-description-cell";
import {
  buildOwnerStewardshipUpsert,
  buildReviewStewardshipUpsert,
  mergeSchemaMetadata,
} from "../schema-explorer.server";
import {
  SchemaExplorerOwnerCell,
  SchemaExplorerReviewCell,
} from "../schema-explorer-stewardship-cells";

jest.mock("server-only", () => ({}));

describe("mergeSchemaMetadata", () => {
  it("prefers a saved description over generated and curated annotations", () => {
    const [table] = mergeSchemaMetadata(
      "PM_APP",
      {
        schema: "public",
        generatedAt: "2026-07-29T00:00:00.000Z",
        tables: [
          {
            name: "unknown_inventory_table",
            columns: [],
            primaryKeyColumns: [],
            foreignKeys: [],
          },
        ],
      },
      new Map([
        ["PM_APP:unknown_inventory_table", "Operator-maintained copy."],
      ]),
      new Map([
        [
          "PM_APP:unknown_inventory_table",
          {
            ownerName: "Platform team",
            lastReviewedAt: "2026-07-30T00:00:00.000Z",
          },
        ],
      ]),
    );

    expect(table.description).toBe("Operator-maintained copy.");
    expect(table.ownerName).toBe("Platform team");
    expect(table.lastReviewedAt).toBe("2026-07-30T00:00:00.000Z");
  });

  it("uses the existing purpose fallback when no saved description exists", () => {
    const [table] = mergeSchemaMetadata("PM_APP", {
      schema: "public",
      generatedAt: "2026-07-29T00:00:00.000Z",
      tables: [
        {
          name: "unknown_inventory_table",
          columns: [],
          primaryKeyColumns: [],
          foreignKeys: [],
        },
      ],
    });

    expect(table.description).toContain("No curated purpose has been recorded");
  });

  it("keeps review evidence out of owner upserts", () => {
    expect(
      buildOwnerStewardshipUpsert(
        "PM_APP",
        "projects",
        "Platform team",
        "2026-07-30T00:00:00.000Z",
      ),
    ).toEqual({
      database_key: "PM_APP",
      table_name: "projects",
      owner_name: "Platform team",
      updated_at: "2026-07-30T00:00:00.000Z",
    });
  });

  it("keeps ownership out of review upserts", () => {
    expect(
      buildReviewStewardshipUpsert(
        "PM_APP",
        "projects",
        "2026-07-30T00:00:00.000Z",
      ),
    ).toEqual({
      database_key: "PM_APP",
      table_name: "projects",
      last_reviewed_at: "2026-07-30T00:00:00.000Z",
      updated_at: "2026-07-30T00:00:00.000Z",
    });
  });

  it("blocks row navigation until one in-flight description save settles", async () => {
    let resolveSave: (value: string) => void = () => undefined;
    const onSave = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onEditingChange = jest.fn();

    render(
      React.createElement(SchemaExplorerDescriptionCell, {
        description: "Original description",
        tableName: "projects",
        onSave,
        onEditingChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /edit description/i }));
    const textarea = screen.getByRole("textbox", {
      name: "Description for projects",
    });
    fireEvent.change(textarea, { target: { value: "Updated description" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    fireEvent.blur(textarea);

    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    expect(onSave).toHaveBeenCalledTimes(1);

    resolveSave("Updated description");

    await waitFor(() => {
      expect(onEditingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("saves and clears an inline owner with the keyboard", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onEditingChange = jest.fn();

    render(
      React.createElement(SchemaExplorerOwnerCell, {
        ownerName: null,
        tableName: "projects",
        onSave,
        onEditingChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /edit owner/i }));
    const input = screen.getByRole("textbox", { name: "Owner for projects" });
    fireEvent.change(input, { target: { value: "Platform team" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Platform team");
      expect(onEditingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("marks a table reviewed without navigating away", async () => {
    const onReview = jest.fn().mockResolvedValue(undefined);

    render(
      React.createElement(SchemaExplorerReviewCell, {
        lastReviewedAt: null,
        tableName: "projects",
        onReview,
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark projects reviewed/i }),
    );

    await waitFor(() => {
      expect(onReview).toHaveBeenCalledTimes(1);
    });
  });
});
