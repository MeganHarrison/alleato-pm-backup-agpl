/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import { Table, TableHead, TableHeader, TableRow } from "../table";

describe("Table", () => {
  it("renders header text with the foreground token instead of the accent color", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SOV Status</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    const header = screen.getByRole("columnheader", { name: "SOV Status" });
    expect(header).toHaveClass("text-foreground");
    expect(header).not.toHaveClass("text-primary");
  });
});
