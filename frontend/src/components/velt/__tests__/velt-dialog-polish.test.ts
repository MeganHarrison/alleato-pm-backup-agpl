/** @jest-environment jsdom */

import { observeVeltCommentDialogPolish } from "../velt-dialog-polish";

function renderVeltDialog() {
  document.body.innerHTML = `
    <velt-comment-dialog-internal>
      <div class="velt-comment-dialog" data-velt-comment-dialog-comments-status="OPEN">
        <velt-comment-dialog-header-internal>
          <div class="velt-header" aria-label="Comment dialog header controls">
            <velt-comment-dialog-status-dropdown-internal>
              <div data-testid="velt-dropdown-trigger" aria-expanded="false"></div>
            </velt-comment-dialog-status-dropdown-internal>
            <div aria-label="Comment options menu">
              <span aria-label="Open comment options menu"></span>
            </div>
          </div>
        </velt-comment-dialog-header-internal>
        <velt-comment-dialog-thread-card-internal>
          <div class="velt-thread-card--author">
            <div aria-label="Thread card options"></div>
          </div>
        </velt-comment-dialog-thread-card-internal>
      </div>
    </velt-comment-dialog-internal>
  `;
}

function renderVeltTextCommentComposer() {
  document.body.innerHTML = `
    <velt-text-comment-internal data-testid="velt-text-comment-container">
      <div class="velt-text-comment">
        <velt-text-comment-tool-internal></velt-text-comment-tool-internal>
        <div data-testid="velt-text-comment-toolbar-container">
          <velt-text-comment-toolbar-internal></velt-text-comment-toolbar-internal>
        </div>
      </div>
    </velt-text-comment-internal>
  `;
}

describe("Velt comment dialog polish", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("marks only a complete Velt dialog contract for compact styling", () => {
    renderVeltDialog();
    const stop = observeVeltCommentDialogPolish(document);

    expect(
      document.querySelector(".velt-comment-dialog")?.getAttribute(
        "data-alleato-dialog-polish",
      ),
    ).toBe("true");
    expect(
      document.querySelector('[aria-label="Comment options menu"]'),
    ).toHaveAttribute("data-alleato-primary-options", "true");
    expect(
      document.querySelector('[aria-label="Thread card options"]'),
    ).toHaveAttribute("data-alleato-redundant-options", "true");

    stop();
  });

  it("opens the native status trigger after a deliberate hover", () => {
    renderVeltDialog();
    const trigger = document.querySelector<HTMLElement>(
      '[data-testid="velt-dropdown-trigger"]',
    )!;
    const click = jest.spyOn(trigger, "click");
    jest.spyOn(trigger, "matches").mockImplementation((selector) => {
      return selector === ":hover";
    });
    const stop = observeVeltCommentDialogPolish(document);

    trigger.dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(139);
    expect(click).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(click).toHaveBeenCalledTimes(1);

    stop();
  });

  it("does not add an internal issue toggle to comment dialogs", () => {
    renderVeltDialog();
    const legacyToggle = document.createElement("button");
    legacyToggle.dataset.alleatoCommentIssueToggle = "true";
    document.body.appendChild(legacyToggle);
    const stop = observeVeltCommentDialogPolish(document);

    expect(
      document.querySelector("[data-alleato-comment-issue-toggle]"),
    ).toBeNull();

    stop();
  });

  it("does not add an internal issue toggle to draft text comments", () => {
    renderVeltTextCommentComposer();
    const stop = observeVeltCommentDialogPolish(document);

    const host = document.querySelector(
      "velt-text-comment-internal[data-testid='velt-text-comment-container']",
    );
    const toggle = host?.querySelector<HTMLButtonElement>(
      "[data-alleato-comment-issue-toggle]",
    );

    expect(host).toHaveAttribute("data-alleato-text-comment-polish", "true");
    expect(toggle).toBeNull();

    stop();
  });

  it("fails loudly and leaves vendor layout intact when the contract drifts", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    document.body.innerHTML = `
      <velt-comment-dialog-internal>
        <div class="velt-comment-dialog"></div>
      </velt-comment-dialog-internal>
    `;

    const stop = observeVeltCommentDialogPolish(document);

    expect(document.querySelector(".velt-comment-dialog")).not.toHaveAttribute(
      "data-alleato-dialog-polish",
    );
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("DOM contract changed"),
    );

    stop();
  });
});
