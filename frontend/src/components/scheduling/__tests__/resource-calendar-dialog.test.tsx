/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ScheduleResourceCapacityProfile } from "@/types/scheduling";
import { ResourceCalendarDialog } from "../resource-calendar-dialog";

const resource = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  project_id: 67,
  person_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Active Person",
  email: null,
  job_title: null,
  person_status: "active" as const,
  membership_status: "active" as const,
  eligible: true,
};

const inheritedProfile: ScheduleResourceCapacityProfile = {
  profile_id: null,
  project_id: 67,
  resource_id: resource.id,
  configured: false,
  version: null,
  coverage_start_date: null,
  coverage_finish_date: null,
  weekday_overrides: [],
  exceptions: [],
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});

describe("ResourceCalendarDialog", () => {
  it("loads lazily and saves sparse weekday and dated project-capacity facts", async () => {
    const onLoad = jest.fn().mockResolvedValue(inheritedProfile);
    const onSave = jest.fn().mockResolvedValue({ ...inheritedProfile, configured: true, version: 1 });

    function Harness() {
      const [profile, setProfile] = useState<ScheduleResourceCapacityProfile | null>(null);
      return (
        <ResourceCalendarDialog
          open
          onOpenChange={jest.fn()}
          resource={resource}
          profile={profile}
          isLoading={false}
          error={null}
          onLoad={async (resourceId) => {
            const loaded = await onLoad(resourceId);
            setProfile(loaded);
            return loaded;
          }}
          onSave={onSave}
        />
      );
    }

    render(<Harness />);
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(resource.id));

    fireEvent.click(screen.getByLabelText("Monday"));
    fireEvent.change(screen.getByLabelText("Monday capacity percent"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Add exception" }));
    fireEvent.change(screen.getByLabelText("Exception 1 date"), { target: { value: "08/05/2026" } });
    fireEvent.change(screen.getByLabelText("Exception 1 capacity"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Project training" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project capacity" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(resource.id, {
      expected_version: null,
      weekday_overrides: [{ weekday: 1, capacity_percent: 80 }],
      exceptions: [{ date: "2026-08-05", capacity_percent: 0, reason: "Project training" }],
    }));
    expect(screen.getByText(/Cross-project availability and time-of-day shifts are not included/i)).toBeInTheDocument();
  });

  it("locks editing and dismissal while a capacity save is in flight", async () => {
    let resolveSave: ((value: ScheduleResourceCapacityProfile) => void) | undefined;
    const onOpenChange = jest.fn();
    const onSave = jest.fn().mockReturnValue(new Promise<ScheduleResourceCapacityProfile>((resolve) => {
      resolveSave = resolve;
    }));

    render(
      <ResourceCalendarDialog
        open
        onOpenChange={onOpenChange}
        resource={resource}
        profile={inheritedProfile}
        isLoading={false}
        error={null}
        onLoad={jest.fn().mockResolvedValue(inheritedProfile)}
        onSave={onSave}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText("Monday")).toBeEnabled());
    fireEvent.click(screen.getByLabelText("Monday"));
    fireEvent.click(screen.getByRole("button", { name: "Save project capacity" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Monday")).toBeDisabled();
    expect(screen.getByLabelText("Monday capacity percent")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add exception" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      resolveSave?.({ ...inheritedProfile, configured: true, version: 1 });
      await Promise.resolve();
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
