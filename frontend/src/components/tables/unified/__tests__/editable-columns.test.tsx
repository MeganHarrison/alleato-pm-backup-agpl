import {
  createInlinePatchHandler,
  editableSelectColumn,
  editableTextColumn,
  type TableColumn,
} from "@/components/tables/unified";

interface Row {
  id: string;
  name: string | null;
  status: string | null;
}

const baseColumn: TableColumn<Row> = {
  id: "name",
  label: "Name",
  render: (row) => row.name,
};

describe("editable table column helpers", () => {
  it("marks text columns editable with a stable string value", () => {
    const onEdit = jest.fn();
    const column = editableTextColumn(baseColumn, {
      getValue: (row) => row.name,
      onEdit,
      inputType: "email",
    });

    expect(column.editable).toBe(true);
    expect(column.editType).toBe("text");
    expect(column.editInputType).toBe("email");
    expect(column.editValue?.({ id: "1", name: null, status: null })).toBe("");
    expect(column.editValue?.({ id: "1", name: "Ada", status: null })).toBe(
      "Ada",
    );
  });

  it("marks static select columns editable with declared options", () => {
    const options = [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ];

    const column = editableSelectColumn(
      { ...baseColumn, id: "status", label: "Status" },
      {
        getValue: (row) => row.status,
        onEdit: jest.fn(),
        options,
      },
    );

    expect(column.editable).toBe(true);
    expect(column.editType).toBe("select");
    expect(column.editOptions).toEqual(options);
    expect(column.editValue?.({ id: "1", name: "Ada", status: "open" })).toBe(
      "open",
    );
  });

  it("builds a typed patch handler and normalizes blank values to null", async () => {
    const update = jest.fn();
    const onInlineEdit = createInlinePatchHandler<Row, "name" | "status">({
      update,
    });
    const row = { id: "1", name: "Ada", status: "open" };

    await onInlineEdit(row, "name", "");
    await onInlineEdit(row, "status", "closed");

    expect(update).toHaveBeenNthCalledWith(1, row, { name: null });
    expect(update).toHaveBeenNthCalledWith(2, row, { status: "closed" });
  });
});
