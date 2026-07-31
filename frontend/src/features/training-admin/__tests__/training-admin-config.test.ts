import {
  TRAINING_ADMIN_TABLES,
  TRAINING_ADMIN_TABS,
  isTrainingAdminTableKey,
} from "../training-admin-config";
import { TRAINING_ADMIN_TABLE_KEYS } from "../types";

describe("training admin table registry", () => {
  it("registers every training-owned table exactly once", () => {
    expect(Object.keys(TRAINING_ADMIN_TABLES)).toEqual([
      ...TRAINING_ADMIN_TABLE_KEYS,
    ]);
    expect(TRAINING_ADMIN_TABS).toHaveLength(10);
    expect(new Set(TRAINING_ADMIN_TABS.map((tab) => tab.href)).size).toBe(10);
  });

  it.each(TRAINING_ADMIN_TABLE_KEYS)(
    "%s has visible, editable, searchable table contracts",
    (tableKey) => {
      const definition = TRAINING_ADMIN_TABLES[tableKey];
      expect(definition.columns.length).toBeGreaterThan(0);
      expect(definition.columns.some((column) => column.alwaysVisible)).toBe(
        true,
      );
      expect(definition.fields.length).toBeGreaterThan(0);
      expect(definition.fields.every((field) => field.label.trim())).toBe(true);
    },
  );

  it("rejects arbitrary table names at the route boundary", () => {
    expect(isTrainingAdminTableKey("training_resource")).toBe(true);
    expect(isTrainingAdminTableKey("user_profiles")).toBe(false);
    expect(isTrainingAdminTableKey("document_chunks")).toBe(false);
  });
});
