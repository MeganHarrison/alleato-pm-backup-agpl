import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlanePageDetailsPrimaryHeader,
  PlanePagesListPrimaryHeader,
} from "./plane-pages-header";
import type { ProjectPage } from "./plane-pages-data";
import { PlanePagesListView } from "./plane-pages-list-view";

const page: ProjectPage = {
  id: 21,
  project_id: 31,
  title: "Turnover plan",
  body: "Closeout sequence",
  archived: false,
  created_at: "2026-07-30T12:00:00.000Z",
  created_by: "user-1",
  updated_at: "2026-07-30T13:00:00.000Z",
};

describe("Plane Pages inner template", () => {
  it("keeps the list action in Plane's primary page header", () => {
    const markup = renderToStaticMarkup(
      <PlanePagesListPrimaryHeader
        isCreating={false}
        onCreate={async () => undefined}
      />,
    );

    expect(markup).toContain("data-plane-pages-primary-header");
    expect(markup).toContain(">Pages<");
    expect(markup).toContain(">Add page<");
  });

  it("keeps page context, save state, and page actions in the detail header", () => {
    const markup = renderToStaticMarkup(
      <PlanePageDetailsPrimaryHeader
        page={page}
        saveStatus={<span>Saved</span>}
        isArchiving={false}
        onBack={() => undefined}
        onToggleArchived={() => undefined}
      />,
    );

    expect(markup).toContain("data-plane-page-details-header");
    expect(markup).toContain("Turnover plan");
    expect(markup).toContain("Saved");
    expect(markup).toContain("Archive");
  });

  it("shows Plane's secondary list controls only after pages exist", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/plane-pages/plane-pages-list-view.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(
      /\{hasAnyPages \? \([\s\S]*data-plane-pages-secondary-header/,
    );
    expect(source).toMatch(
      /<PlanePagesListPrimaryHeader[\s\S]*\{hasAnyPages \? \(/,
    );
  });

  it("pins Plane's page row identity, access, owner, and action composition", () => {
    const markup = renderToStaticMarkup(
      <PlanePagesListView
        pages={[page]}
        hasAnyPages
        scope="active"
        query=""
        sortKey="updated_at"
        sortOrder="desc"
        isCreating={false}
        onArchive={async () => undefined}
        onCreate={async () => undefined}
        onQueryChange={() => undefined}
        onScopeChange={() => undefined}
        onSelect={() => undefined}
        onSortKeyChange={() => undefined}
        onSortOrderChange={() => undefined}
      />,
    );

    expect(markup).toContain("Turnover plan");
    expect(markup).toContain('title="Owner user-1"');
    expect(markup).toContain('aria-label="Public"');
    expect(markup).toContain('aria-label="Actions for Turnover plan"');
  });

  it("pins create, editor persistence, and archive calls to project-scoped owners", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/plane-pages/plane-pages-workspace.tsx",
      ),
      "utf8",
    );
    const adapterSource = readFileSync(
      path.join(
        process.cwd(),
        "src/features/plane-pages-editor/notes-adapter.ts",
      ),
      "utf8",
    );

    expect(source).toMatch(/createProjectPage\(projectId\)/);
    expect(source).toMatch(/createProjectNotesEditorAdapter\(\{/);
    expect(source).toMatch(/<PlanePagesEditor/);
    expect(source).toMatch(
      /updateProjectPage\(projectId,\s*page\.id,\s*\{\s*archived: nextArchived/,
    );
    expect(adapterSource).toMatch(/listProjectPages\(projectId\)/);
    expect(adapterSource).toMatch(
      /updateProjectPage\(projectId, numericPageId, \{/,
    );
    expect(adapterSource).toContain(
      "capabilities: { comments: false, versions: false }",
    );
  });
});
