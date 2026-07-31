/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { apiFetch } from "@/lib/api-client";
import { useScheduleResources } from "../use-schedule-resources";

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("useScheduleResources", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clears loading and stale state when disabled during an in-flight request", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    apiFetchMock.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const { result, rerender } = renderHook(
      ({ enabled }) => useScheduleResources({ projectId: "67", enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.roster).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveRequest?.({
        resources: [],
        candidates: [],
        assignments: [],
        can_manage: false,
        legacy_assignment_count: 0,
      });
      await Promise.resolve();
    });
    expect(result.current.roster).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("upserts a resource's first saved capacity profile into the visible range", async () => {
    apiFetchMock.mockResolvedValueOnce({
      resources: [],
      candidates: [],
      assignments: [],
      can_manage: true,
      legacy_assignment_count: 0,
    });
    const { result } = renderHook(() => useScheduleResources({ projectId: "67" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    apiFetchMock.mockResolvedValueOnce({
      project_id: 67,
      range: { start: "2026-07-27", finish: "2026-07-29" },
      profiles: [],
    });
    await act(async () => {
      await result.current.loadCapacityRange("2026-07-27", "2026-07-29");
    });

    apiFetchMock.mockResolvedValueOnce({
      data: {
        profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        project_id: 67,
        resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        configured: true,
        version: 1,
        coverage_start_date: null,
        coverage_finish_date: null,
        weekday_overrides: [{ weekday: 1, capacity_percent: 50 }],
        exceptions: [],
      },
    });
    await act(async () => {
      await result.current.replaceCapacityProfile(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        { expected_version: null, weekday_overrides: [{ weekday: 1, capacity_percent: 50 }], exceptions: [] },
      );
    });

    expect(result.current.capacityRange?.profiles).toEqual([
      expect.objectContaining({
        resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        coverage_start_date: "2026-07-27",
        coverage_finish_date: "2026-07-29",
        weekday_overrides: [{ weekday: 1, capacity_percent: 50 }],
      }),
    ]);
  });

  it("invalidates an in-flight leveling preview after capacity is saved", async () => {
    apiFetchMock.mockResolvedValueOnce({
      resources: [],
      candidates: [],
      assignments: [],
      can_manage: true,
      legacy_assignment_count: 0,
    });
    const { result } = renderHook(() => useScheduleResources({ projectId: "67" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolvePreview: ((value: unknown) => void) | undefined;
    let resolveSave: ((value: unknown) => void) | undefined;
    apiFetchMock.mockReturnValueOnce(new Promise((resolve) => { resolvePreview = resolve; }));
    apiFetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));

    let previewRequest!: ReturnType<typeof result.current.previewResourceLeveling>;
    act(() => { previewRequest = result.current.previewResourceLeveling(); });
    await waitFor(() => expect(result.current.isLevelingPreviewLoading).toBe(true));

    let saveRequest!: ReturnType<typeof result.current.replaceCapacityProfile>;
    act(() => {
      saveRequest = result.current.replaceCapacityProfile(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        { expected_version: null, weekday_overrides: [{ weekday: 1, capacity_percent: 50 }], exceptions: [] },
      );
    });
    await act(async () => {
      resolveSave?.({
        data: {
          profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          project_id: 67,
          resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          configured: true,
          version: 1,
          coverage_start_date: null,
          coverage_finish_date: null,
          weekday_overrides: [{ weekday: 1, capacity_percent: 50 }],
          exceptions: [],
        },
      });
      await saveRequest;
    });
    expect(result.current.levelingPreview).toBeNull();
    expect(result.current.isLevelingPreviewLoading).toBe(false);

    await act(async () => {
      resolvePreview?.({
        data: {
          status: "available",
          proposals: [],
          diagnostics: [],
          notice: "stale preview",
        },
      });
      await previewRequest;
    });
    expect(result.current.levelingPreview).toBeNull();
    expect(result.current.isLevelingPreviewLoading).toBe(false);
  });

  it("rejects a long-span capacity merge when profile versions drift between chunks", async () => {
    apiFetchMock.mockResolvedValueOnce({
      resources: [],
      candidates: [],
      assignments: [],
      can_manage: true,
      legacy_assignment_count: 0,
    });
    const { result } = renderHook(() => useScheduleResources({ projectId: "67" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const profile = {
      profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      project_id: 67,
      resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      configured: true,
      coverage_start_date: "2026-01-01",
      coverage_finish_date: "2026-04-02",
      weekday_overrides: [{ weekday: 1, capacity_percent: 50 }],
      exceptions: [],
    };
    apiFetchMock
      .mockResolvedValueOnce({
        project_id: 67,
        range: { start: "2026-01-01", finish: "2026-04-02" },
        profiles: [{ ...profile, version: 1 }],
      })
      .mockResolvedValueOnce({
        project_id: 67,
        range: { start: "2026-04-03", finish: "2026-04-03" },
        profiles: [{
          ...profile,
          version: 2,
          coverage_start_date: "2026-04-03",
          coverage_finish_date: "2026-04-03",
        }],
      });

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.fetchCapacityProfilesForRange("2026-01-01", "2026-04-03");
      } catch (error) {
        failure = error;
      }
    });

    expect(failure).toEqual(expect.objectContaining({
      message: expect.stringMatching(/changed while this date range was loading/i),
    }));
  });
});
