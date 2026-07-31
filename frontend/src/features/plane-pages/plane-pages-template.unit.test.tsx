import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlanePageDetailsPrimaryHeader,
  PlanePagesListPrimaryHeader,
} from "./plane-pages-header";
import { PlanePageEditor } from "./plane-page-editor";
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

  it("pins the editor canvas and visibly disabled Plane-only affordances", () => {
    const markup = renderToStaticMarkup(
      <PlanePageEditor
        page={page}
        draft={{ title: "Turnover plan", body: "Closeout sequence" }}
        saveState="saved"
        isArchiving={false}
        onBack={() => undefined}
        onDraftChange={() => undefined}
        onSave={() => undefined}
        onToggleArchived={() => undefined}
      />,
    );

    expect(markup).toContain("data-plane-page-toolbar");
    expect(markup).toContain('aria-label="Page title"');
    expect(markup).toContain('aria-label="Page content"');
    expect(markup).toContain(
      'title="Outline and version history require Plane collaboration metadata."',
    );
    expect(markup).toContain(
      'title="Page icons require Plane logo metadata."',
    );
    expect(markup).toMatch(
      /disabled=""[^>]*title="Outline and version history require Plane collaboration metadata\."/,
    );
    expect(markup).toMatch(
      /disabled=""[^>]*title="Page icons require Plane logo metadata\."/,
    );
  });

  it("pins create, autosave, and archive calls to the project-scoped data owner", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/plane-pages/plane-pages-workspace.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(/createProjectPage\(projectId\)/);
    expect(source).toMatch(
      /updateProjectPage\(projectId,\s*selectedPage\.id,\s*\{/,
    );
    expect(source).toMatch(/window\.setTimeout\(\(\) => \{[\s\S]*\}, 700\)/);
    expect(source).toMatch(
      /updateProjectPage\(projectId,\s*page\.id,\s*\{\s*archived: nextArchived/,
    );
  });
});
