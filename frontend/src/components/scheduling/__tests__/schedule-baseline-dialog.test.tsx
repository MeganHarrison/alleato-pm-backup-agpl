/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { ScheduleBaselineDialog } from "../schedule-baseline-dialog";

it("keeps plan history behind one disclosure and captures a named published revision", () => {
  const onCapture = jest.fn();
  render(
    <ScheduleBaselineDialog
      baselines={[{ id: "baseline-1", project_id: 43, revision_id: "revision-1", name: "Contract baseline", is_active: true, created_at: "2026-08-01T00:00:00Z", activated_at: "2026-08-01T00:00:00Z" }]}
      revisions={[{ id: "revision-2", revision_number: 2, status: "published", published_at: "2026-08-02T00:00:00Z" }]}
      canManage
      onCapture={onCapture}
      onActivate={jest.fn()}
    />,
  );

  expect(screen.queryByText("Capture named baseline")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Plan history" }));
  fireEvent.change(screen.getByLabelText("Baseline name"), { target: { value: "Owner baseline" } });
  fireEvent.click(screen.getByRole("button", { name: "Capture baseline" }));
  expect(onCapture).toHaveBeenCalledWith({ name: "Owner baseline", revisionId: "revision-2", activate: true });
});
