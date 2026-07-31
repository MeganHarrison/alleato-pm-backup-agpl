/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BackendStatusIndicator } from "../misc/backend-status-indicator";

// Mock fetch
global.fetch = jest.fn();

describe("BackendStatusIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows loading state initially", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<BackendStatusIndicator />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows connected state when backend is healthy", async () => {
    const payload = JSON.stringify({
      status: "healthy",
      backend: true,
      openai_configured: true,
      timestamp: new Date().toISOString(),
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => payload,
      json: async () => JSON.parse(payload),
    });

    render(<BackendStatusIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Backend online")).toBeInTheDocument();
    });
  });

  it("shows disconnected state when fetch fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    // apiFetch wraps fetch — when fetch rejects, BackendStatusIndicator catches
    // the error and shows "Backend offline"

    render(<BackendStatusIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Backend offline")).toBeInTheDocument();
    });
  });

  it("shows AI not configured when openai_configured is false", async () => {
    const payload = JSON.stringify({
      status: "healthy",
      backend: true,
      openai_configured: false,
      timestamp: new Date().toISOString(),
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => payload,
      json: async () => JSON.parse(payload),
    });

    render(<BackendStatusIndicator />);

    await waitFor(() => {
      expect(screen.getByText("AI not configured")).toBeInTheDocument();
    });
  });

  it("shows error message when backend returns error", async () => {
    const payload = JSON.stringify({
      status: "error",
      backend: false,
      openai_configured: false,
      timestamp: new Date().toISOString(),
      error: "Backend unavailable",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => payload,
      json: async () => JSON.parse(payload),
    });

    render(<BackendStatusIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
    });
  });

  it("polls health check periodically", async () => {
    jest.useFakeTimers();

    const payload = JSON.stringify({
      status: "healthy",
      backend: true,
      openai_configured: true,
      timestamp: new Date().toISOString(),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => payload,
      json: async () => JSON.parse(payload),
    });

    render(<BackendStatusIndicator />);

    // Initial call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    await screen.findByText("Backend online");

    // Fast forward 30 seconds (poll interval)
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
