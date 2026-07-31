/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CalendarSettingsDialog } from "../calendar-settings-dialog";

describe("CalendarSettingsDialog", () => {
  it("submits weekday and dated exception settings together", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CalendarSettingsDialog open onOpenChange={jest.fn()} calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /add date/i }));
    fireEvent.change(screen.getByLabelText("Exception date 1"), { target: { value: "2026-12-25" } });
    fireEvent.change(screen.getByLabelText("Reason 1"), { target: { value: "Christmas Day" } });
    fireEvent.click(screen.getByRole("button", { name: /save calendar/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      working_weekdays: [1, 2, 3, 4, 5],
      exceptions: [{ date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
    }));
  });

  it("loads the saved reason when editing an existing exception", () => {
    render(<CalendarSettingsDialog
      open
      onOpenChange={jest.fn()}
      calendar={{
        working_weekdays: [1, 2, 3, 4, 5],
        non_working_dates: ["2026-12-25"],
        exceptions: [{ date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
      }}
      onSave={jest.fn()}
    />);

    expect(screen.getByLabelText("Reason 1")).toHaveValue("Christmas Day");
  });

  it("keeps the dialog open and explains a rejected save", async () => {
    const onOpenChange = jest.fn();
    const onSave = jest.fn().mockRejectedValue(new Error("Unable to save schedule calendar: permission denied"));
    render(<CalendarSettingsDialog
      open
      onOpenChange={onOpenChange}
      calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
      onSave={onSave}
    />);

    fireEvent.click(screen.getByRole("button", { name: /save calendar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save schedule calendar: permission denied");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("disables saving when the existing calendar has not loaded", () => {
    const onSave = jest.fn();
    render(<CalendarSettingsDialog
      open
      onOpenChange={jest.fn()}
      calendar={{ working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }}
      onSave={onSave}
      saveDisabledReason="Reload the saved schedule calendar before making changes."
    />);

    expect(screen.getByRole("button", { name: /save calendar/i })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
