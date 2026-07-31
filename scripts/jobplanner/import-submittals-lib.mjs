export function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function mapSubmittalStatus(jobPlannerSubmittal) {
  if (jobPlannerSubmittal?.isClosed) return "Closed";
  return "Open";
}

export function normalizeItemTypeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function mapSubmittalTypeName(itemTypes) {
  const names = Array.isArray(itemTypes)
    ? itemTypes.map((itemType) => String(itemType?.name ?? "").trim()).filter(Boolean)
    : [];

  if (names.length === 0) return "Other";

  const normalized = normalizeItemTypeName(names[0]);

  if (normalized === "drawings") return "Drawings";
  if (normalized === "material samples") return "Material Samples";
  if (normalized === "contract documents") return "Contract";
  if (normalized === "specification sheets") return "Product Data Sheets";

  return names[0];
}

export function formatPartyDisplay(party) {
  if (!party || typeof party !== "object") return null;
  const contactName = String(party.contactName ?? "").trim();
  const companyName = String(party.companyName ?? "").trim();

  if (contactName && companyName) return `${contactName} (${companyName})`;
  if (contactName) return contactName;
  if (companyName) return companyName;
  return null;
}

export function buildSubmittalMetadata(jobPlannerProjectId, jobPlannerSubmittal) {
  return {
    source_system: "jobplanner",
    jobplanner: {
      project_id: jobPlannerProjectId,
      submittal_id: jobPlannerSubmittal.submittalId ?? null,
      folder_id: jobPlannerSubmittal.folderId ?? null,
      status_id: jobPlannerSubmittal.statusId ?? null,
      item_type_names: Array.isArray(jobPlannerSubmittal.itemTypes)
        ? jobPlannerSubmittal.itemTypes.map((itemType) => itemType?.name).filter(Boolean)
        : [],
      manager_email: jobPlannerSubmittal.manager?.email ?? null,
      manager_name: jobPlannerSubmittal.manager?.contactName ?? null,
      responsible_company: jobPlannerSubmittal.ballInCourt?.companyName ?? null,
      responsible_contact: jobPlannerSubmittal.ballInCourt?.contactName ?? null,
      last_synced_at: new Date().toISOString(),
    },
  };
}
