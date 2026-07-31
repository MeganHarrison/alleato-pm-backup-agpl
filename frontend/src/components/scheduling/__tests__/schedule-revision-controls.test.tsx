/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { ScheduleRevisionControls } from "../schedule-revision-controls";

const revisions = [
  { id: "draft", revision_number: 3, status: "draft", published_at: null },
  { id: "published", revision_number: 2, status: "published", published_at: "2026-08-02T10:00:00.000Z" },
];

it("shows the current published revision and exposes only valid next controls", () => {
  const onSnapshot = jest.fn();
  const onTransition = jest.fn();
  render(<ScheduleRevisionControls revisions={revisions} canManageSchedule onSnapshot={onSnapshot} onTransition={onTransition} />);

  expect(screen.getByText("Published revision 2")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Revision history"));
  expect(screen.getByText("Revision 3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Request review" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Publish revision" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Snapshot schedule" }));
  expect(onSnapshot).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Request review" }));
  expect(onTransition).toHaveBeenCalledWith("draft", "review");
});

it("allows publication only for a revision already in review", () => {
  const onTransition = jest.fn();
  render(<ScheduleRevisionControls revisions={[{ id: "review", revision_number: 4, status: "review", published_at: null }]} canManageSchedule onSnapshot={jest.fn()} onTransition={onTransition} />);
  fireEvent.click(screen.getByText("Revision history"));
  fireEvent.click(screen.getByRole("button", { name: "Publish revision" }));
  expect(onTransition).toHaveBeenCalledWith("review", "published");
});

it("keeps transition controls hidden for members without schedule-admin capability", () => {
  render(<ScheduleRevisionControls revisions={revisions} onSnapshot={jest.fn()} onTransition={jest.fn()} />);
  fireEvent.click(screen.getByText("Revision history"));
  expect(screen.queryByRole("button", { name: "Request review" })).not.toBeInTheDocument();
});
