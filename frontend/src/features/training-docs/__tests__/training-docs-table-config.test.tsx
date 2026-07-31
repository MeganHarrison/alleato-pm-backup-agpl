/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import {
  buildTrainingDocTableColumns,
  type TrainingDocEditableField,
} from "../training-docs-table-config";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";

const doc = {
  id: "doc-1",
  slug: "how-to-log-an-rfi",
  title: "How to log an RFI",
  status: "draft",
  audience: "internal",
  source_route: "/rfis",
  summary: "Walkthrough for logging an RFI.",
  body_markdown: "# How to log an RFI",
  published_doc_path: null,
  last_published_at: null,
  assets: [],
  steps: [],
} as unknown as TrainingDocWithAssets;

function renderTitleCell() {
  const noopEdit = async (
    _doc: TrainingDocWithAssets,
    _field: TrainingDocEditableField,
    _value: string,
  ) => {};
  const columns = buildTrainingDocTableColumns(noopEdit);
  const titleColumn = columns.find((column) => column.id === "title");
  if (!titleColumn?.render) throw new Error("title column has no render");
  return render(<>{titleColumn.render(doc, 0)}</>);
}

describe("training docs table — title column", () => {
  it("renders the title", () => {
    renderTitleCell();
    expect(screen.getByText("How to log an RFI")).toBeInTheDocument();
  });

  it("does not stack the slug under the title", () => {
    // Regression: the slug used to render as a second muted line inside the
    // Title cell. Table cells render one attribute — a second line makes rows
    // ragged and hides the value from sort/filter/CSV.
    // See docs/design/noise-gate-log.md #38.
    const { container } = renderTitleCell();
    expect(screen.queryByText(doc.slug)).not.toBeInTheDocument();
    expect(container.querySelector(".text-muted-foreground")).toBeNull();
  });
});
