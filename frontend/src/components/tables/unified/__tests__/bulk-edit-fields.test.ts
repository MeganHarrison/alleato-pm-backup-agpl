import { deriveBulkEditFields } from "../unified-table-page";
import type { TableColumn } from "../unified-table-page";

// Minimal column factory — only the fields deriveBulkEditFields reads matter.
function column<T>(partial: Partial<TableColumn<T>> & { id: string; label: string }): TableColumn<T> {
  return {
    render: () => null,
    ...partial,
  } as TableColumn<T>;
}

describe("deriveBulkEditFields", () => {
  const noop = () => {};

  it("returns nothing when inline editing is disabled", () => {
    const columns = [
      column({ id: "type", label: "Type", editable: true, editType: "text", onEdit: noop }),
    ];
    expect(deriveBulkEditFields(columns, false)).toEqual([]);
  });

  it("skips columns that are not editable or have no onEdit handler", () => {
    const columns = [
      column({ id: "title", label: "Title" }),
      column({ id: "type", label: "Type", editable: true, editType: "text" }), // no onEdit
      column({ id: "readonly", label: "Read only", editType: "text", onEdit: noop }), // not editable
    ];
    expect(deriveBulkEditFields(columns)).toEqual([]);
  });

  it("derives a text field with the resolved input type", () => {
    const columns = [
      column({ id: "count", label: "Count", editable: true, editType: "number", onEdit: noop }),
      column({ id: "due", label: "Due", editable: true, editType: "date", onEdit: noop }),
    ];
    const fields = deriveBulkEditFields(columns);
    expect(fields).toEqual([
      { id: "count", label: "Count", type: "text", options: undefined, inputType: "number" },
      { id: "due", label: "Due", type: "text", options: undefined, inputType: "date" },
    ]);
  });

  it("derives a select field only when editOptions are present", () => {
    const withOptions = column({
      id: "status",
      label: "Status",
      editable: true,
      editType: "select",
      editOptions: [
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
      ],
      onEdit: noop,
    });
    const withoutOptions = column({
      id: "owner",
      label: "Owner",
      editable: true,
      editType: "select",
      onEdit: noop,
      // custom renderEditor, no editOptions → not derivable
    });

    const fields = deriveBulkEditFields([withOptions, withoutOptions]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ id: "status", type: "select" });
    expect(fields[0].options).toHaveLength(2);
  });

  it("supplies Yes/No options for boolean columns without explicit options", () => {
    const columns = [
      column({ id: "active", label: "Active", editable: true, editType: "boolean", onEdit: noop }),
    ];
    const fields = deriveBulkEditFields(columns);
    expect(fields[0].type).toBe("select");
    expect(fields[0].options).toEqual([
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ]);
  });
});
