/** @jest-environment jsdom */

import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  Popover,
  PopoverContent,
  PopoverLayerProvider,
} from "@/components/ui/popover";

describe("global AI widget overlay ownership", () => {
  const widgetSource = readFileSync(
    resolve(__dirname, "..", "global-ai-widget.tsx"),
    "utf8",
  );
  const popoverSource = readFileSync(
    resolve(__dirname, "..", "..", "ui", "popover.tsx"),
    "utf8",
  );
  const chatAreaSource = readFileSync(
    resolve(__dirname, "..", "chat-area.tsx"),
    "utf8",
  );
  const globalsSource = readFileSync(
    resolve(__dirname, "..", "..", "..", "app", "globals.css"),
    "utf8",
  );

  it("elevates all portaled popovers launched inside the fixed widget", () => {
    expect(widgetSource).toContain(
      '<PopoverLayerProvider layer="global-ai-widget">',
    );
    expect(popoverSource).toContain('layer === "global-ai-widget"');
    expect(popoverSource).toContain('"global-ai-widget-overlay"');

    const panelZ = Number(
      globalsSource.match(
        /\.global-ai-widget-panel\s*\{[\s\S]*?z-index:\s*(\d+)/,
      )?.[1],
    );
    const overlayZ = Number(
      globalsSource.match(
        /\.global-ai-widget-overlay\s*\{[\s\S]*?z-index:\s*(\d+)/,
      )?.[1],
    );
    expect(panelZ).toBeGreaterThan(0);
    expect(overlayZ).toBeGreaterThan(panelZ);
  });

  it("carries the widget layer through the portal and keeps option interaction live", () => {
    const onSelect = jest.fn();
    render(
      React.createElement(
        PopoverLayerProvider,
        { layer: "global-ai-widget" },
        React.createElement(
          Popover,
          { defaultOpen: true },
          React.createElement(
            PopoverContent,
            { "data-testid": "widget-popover" },
            React.createElement(
              "button",
              { type: "button", onClick: onSelect },
              "Select project",
            ),
          ),
        ),
      ),
    );

    expect(screen.getByTestId("widget-popover")).toHaveClass(
      "global-ai-widget-overlay",
    );
    fireEvent.click(screen.getByRole("button", { name: "Select project" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("exposes the selected project name as composer state", () => {
    expect(chatAreaSource).toContain("Project context: ${selectedProject.name");
    expect(chatAreaSource).toContain("aria-pressed={Boolean(selectedProject)}");
  });

  it("uses the shared MKH identity and rejects legacy widget branding", () => {
    expect(widgetSource).toContain('import { MkhLogo } from "@/components/brand/mkh-logo"');
    expect(widgetSource).toContain('aria-label="MKH AI"');
    expect(widgetSource).toContain("<MkhLogo");
    expect(widgetSource).toContain('"MKH AI"');
    expect(widgetSource).not.toContain('src="/alleato-favicon.png"');
    expect(widgetSource).not.toContain('"Alleato AI"');
  });
});
