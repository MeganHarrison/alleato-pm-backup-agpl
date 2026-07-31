import { describe, expect, test } from "@jest/globals";

import {
  evaluateDeterministic,
  normalizeRoute,
  routeHasUnresolvedParam,
  type LivePageContext,
} from "../qa-evaluate";
import type { TrainingDocWithAssets } from "../types";

function makeDoc(
  overrides: Partial<TrainingDocWithAssets> = {},
): TrainingDocWithAssets {
  return {
    id: "doc-1",
    title: "Create a commitment",
    slug: "create-a-commitment",
    source_route: "/1034/commitments/new",
    steps: [],
    assets: [],
    ...overrides,
  } as unknown as TrainingDocWithAssets;
}

function makePage(overrides: Partial<LivePageContext> = {}): LivePageContext {
  return {
    loaded: true,
    httpStatus: 200,
    finalPathname: "/1034/commitments/new",
    redirectedToAuth: false,
    title: "Create a commitment",
    headings: ["Create a commitment"],
    labels: ["Contract company", "Title"],
    buttons: ["Save", "Cancel"],
    hasFormControls: true,
    captureError: null,
    ...overrides,
  };
}

function stepWithButtons(buttons: string[]) {
  return {
    id: "step-1",
    training_doc_id: "doc-1",
    step_order: 0,
    title: "Review and continue",
    instruction_markdown: "",
    action_metadata: { buttons },
  } as unknown as TrainingDocWithAssets["steps"][number];
}

describe("routeHasUnresolvedParam", () => {
  test("flags un-substituted [param] placeholders", () => {
    expect(routeHasUnresolvedParam("/[projectId]/commitments")).toBe(true);
    expect(routeHasUnresolvedParam("/1034/commitments")).toBe(false);
    expect(routeHasUnresolvedParam(null)).toBe(false);
  });
});

describe("normalizeRoute", () => {
  test("normalizes relative routes and extracts pathname from absolute URLs", () => {
    expect(normalizeRoute(" 1034/budget ")).toBe("/1034/budget");
    expect(normalizeRoute("/1034/budget")).toBe("/1034/budget");
    expect(normalizeRoute("https://app.example.com/1034/budget?x=1")).toBe(
      "/1034/budget",
    );
    expect(normalizeRoute("")).toBeNull();
    expect(normalizeRoute(null)).toBeNull();
  });
});

describe("evaluateDeterministic — hard route failures", () => {
  test("route that did not load is failing", () => {
    const verdict = evaluateDeterministic(
      makeDoc(),
      makePage({ loaded: false, httpStatus: null, captureError: "timeout" }),
    );
    expect(verdict.status).toBe("failing");
    expect(verdict.hardFail).toBe(true);
  });

  test("HTTP >= 400 is failing", () => {
    const verdict = evaluateDeterministic(
      makeDoc(),
      makePage({ httpStatus: 404 }),
    );
    expect(verdict.status).toBe("failing");
    expect(verdict.hardFail).toBe(true);
  });

  test("redirect to auth is failing", () => {
    const verdict = evaluateDeterministic(
      makeDoc(),
      makePage({ redirectedToAuth: true, finalPathname: "/auth/login" }),
    );
    expect(verdict.status).toBe("failing");
    expect(verdict.hardFail).toBe(true);
  });

  test("blank page (no title, no controls, no headings) is failing", () => {
    const verdict = evaluateDeterministic(
      makeDoc(),
      makePage({
        title: "",
        headings: [],
        hasFormControls: false,
        labels: [],
        buttons: [],
      }),
    );
    expect(verdict.status).toBe("failing");
    expect(verdict.hardFail).toBe(true);
  });
});

describe("evaluateDeterministic — passing and drift", () => {
  test("healthy page with matching title and no referenced terms is passing", () => {
    const verdict = evaluateDeterministic(makeDoc(), makePage());
    expect(verdict.status).toBe("passing");
    expect(verdict.hardFail).toBe(false);
  });

  test("referenced button missing from the live page is needs_update", () => {
    const doc = makeDoc({
      steps: [stepWithButtons(["Create commitment"])],
    });
    const verdict = evaluateDeterministic(
      doc,
      makePage({ buttons: ["Save", "Cancel"] }),
    );
    expect(verdict.status).toBe("needs_update");
    expect(verdict.hardFail).toBe(false);
    expect(verdict.signals.join(" ")).toContain("Create commitment");
  });

  test("referenced button still present keeps the doc passing", () => {
    const doc = makeDoc({ steps: [stepWithButtons(["Save"])] });
    const verdict = evaluateDeterministic(
      doc,
      makePage({ buttons: ["Save", "Cancel"] }),
    );
    expect(verdict.status).toBe("passing");
  });

  test("page title unrelated to the doc title is needs_update", () => {
    const verdict = evaluateDeterministic(
      makeDoc({ title: "Create a commitment" }),
      makePage({ title: "Project schedule", headings: ["Project schedule"] }),
    );
    expect(verdict.status).toBe("needs_update");
  });
});
