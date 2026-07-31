const FIELD_NAME_MAP: Record<string, string> = {
  title: "Title",
  type: "Type",
  reason: "Change Reason",
  scope: "Scope",
  status: "Status",
  notes: "Description",
  deleted: "Deleted",
  line_item_added: "Line Item Added",
  line_item_removed: "Line Item Removed",
  line_item_updated: "Line Item Updated",
  attachment_added: "Attachment Added",
  attachment_removed: "Attachment Removed",
  expecting_revenue: "Expecting Revenue",
  line_item_revenue_source: "Revenue Source",
};

export function formatHistoryFieldName(fieldName: string): string {
  return (
    FIELD_NAME_MAP[fieldName] ||
    fieldName
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function formatHistoryFieldValue(
  fieldName: string,
  value: string | null,
): string | null {
  if (value === null) return null;
  switch (fieldName) {
    case "type":
    case "scope":
    case "status":
    case "line_item_revenue_source":
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    case "expecting_revenue":
    case "deleted":
      return value === "true" ? "Yes" : "No";
    default:
      return value;
  }
}

export interface HistoryEntryInput {
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

export function generateHistoryDescription(entry: HistoryEntryInput): string {
  const { change_type, field_name, old_value, new_value } = entry;
  switch (change_type) {
    case "CREATE":
      return "Change event created";
    case "DELETE":
      return "Change event deleted";
    case "VOID":
      return "Change event voided";
    case "RECOVER":
      return "Change event recovered from recycle bin";
    case "UPDATE":
      if (field_name === "line_item_added")
        return `Added line item: "${new_value}"`;
      if (field_name === "line_item_removed")
        return `Removed line item: "${old_value}"`;
      if (field_name === "line_item_updated") return "Updated line item";
      if (field_name === "attachment_added")
        return `Added attachment: "${new_value}"`;
      if (field_name === "attachment_removed")
        return `Removed attachment: "${old_value}"`;
      if (field_name === "deleted")
        return new_value === "true"
          ? "Change event deleted"
          : "Change event restored";
      if (old_value && new_value) {
        return `Changed ${formatHistoryFieldName(field_name)} from "${formatHistoryFieldValue(field_name, old_value)}" to "${formatHistoryFieldValue(field_name, new_value)}"`;
      } else if (new_value) {
        return `Set ${formatHistoryFieldName(field_name)} to "${formatHistoryFieldValue(field_name, new_value)}"`;
      }
      return `Cleared ${formatHistoryFieldName(field_name)}`;
    default:
      return `${change_type} - ${field_name}`;
  }
}

export type ChangedByValue = string | { id: string; email: string } | null;

export async function resolveUserEmails(
  userIds: string[],
  getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }>,
  context: string,
): Promise<Record<string, string>> {
  const userEmailById: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data } = await getUserById(userId);
        if (data?.user?.email) {
          userEmailById[userId] = data.user.email;
        }
      } catch (err) {
        console.error(`[${context}] Failed to resolve email for user ${userId}:`, err);
      }
    }),
  );
  return userEmailById;
}

export function mapChangedBy(
  uid: string | null,
  userEmailById: Record<string, string>,
): ChangedByValue {
  if (!uid) return null;
  return userEmailById[uid] ? { id: uid, email: userEmailById[uid] } : uid;
}
