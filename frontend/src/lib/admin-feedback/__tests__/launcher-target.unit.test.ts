/** @jest-environment jsdom */

import { getBestComposerTarget } from "@/lib/admin-feedback/launcher-target";

describe("getBestComposerTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("prefers the app main content over an unrelated visible dialog", () => {
    document.body.innerHTML = `
      <div role="dialog" id="task-dialog"></div>
      <main data-feedback-id="app.main-content" id="page-main"></main>
    `;

    const dialog = document.getElementById("task-dialog") as HTMLElement;
    const main = document.getElementById("page-main") as HTMLElement;

    Object.defineProperty(dialog, "offsetParent", { value: document.body });
    Object.defineProperty(main, "offsetParent", { value: document.body });

    expect(getBestComposerTarget()).toBe(main);
  });

  it("falls back to a visible foreign dialog when no main content exists", () => {
    document.body.innerHTML = `<div role="dialog" id="task-dialog"></div>`;
    const dialog = document.getElementById("task-dialog") as HTMLElement;
    Object.defineProperty(dialog, "offsetParent", { value: document.body });

    expect(getBestComposerTarget()).toBe(dialog);
  });
});
