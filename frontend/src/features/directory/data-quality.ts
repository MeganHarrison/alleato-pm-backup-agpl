export type DirectoryDataQualitySeverity = "warning" | "info";

export interface DirectoryDataQualityIssue {
  id: string;
  label: string;
  severity: DirectoryDataQualitySeverity;
}

interface CompanyQualitySource {
  contact_count: number;
  project_count: number;
  business_phone: string | null;
  email_address: string | null;
  website: string | null;
  company_type: string | null;
  status: string | null;
  primary_contact_id: string | null;
}

interface VendorQualitySource {
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  payment_method: string | null;
  terms: string | null;
  acumatica_vendor_id: string | null;
  status: string | null;
}

function hasValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !["{}", "[]", "null", "undefined"].includes(normalized);
}

function issue(
  id: string,
  label: string,
  severity: DirectoryDataQualitySeverity = "warning",
): DirectoryDataQualityIssue {
  return { id, label, severity };
}

export function getCompanyDataQualityIssues(
  company: CompanyQualitySource,
): DirectoryDataQualityIssue[] {
  const issues: DirectoryDataQualityIssue[] = [];

  if (!company.status) {
    issues.push(issue("missing-status", "Missing status"));
  }
  if (!company.company_type) {
    issues.push(issue("missing-type", "Missing type"));
  }
  if (company.contact_count <= 0) {
    issues.push(issue("no-contacts", "No contacts"));
  } else if (!company.primary_contact_id) {
    issues.push(issue("no-primary-contact", "No primary contact", "info"));
  }
  if (!hasValue(company.business_phone) && !hasValue(company.email_address)) {
    issues.push(issue("no-contact-method", "No contact method"));
  }
  if (company.project_count <= 0) {
    issues.push(issue("no-projects", "No projects", "info"));
  }
  if (!hasValue(company.website)) {
    issues.push(issue("no-website", "No website", "info"));
  }

  return issues;
}

export function getVendorDataQualityIssues(
  vendor: VendorQualitySource,
): DirectoryDataQualityIssue[] {
  const issues: DirectoryDataQualityIssue[] = [];
  const hasContactName = hasValue(vendor.contact_name);
  const hasContactEmail = hasValue(vendor.contact_email);
  const hasContactPhone = hasValue(vendor.contact_phone);
  const hasAnyContact = hasContactName || hasContactEmail || hasContactPhone;

  if (!vendor.status) {
    issues.push(issue("missing-status", "Missing status"));
  }
  if (!hasAnyContact) {
    issues.push(issue("no-vendor-contact", "No vendor contact"));
  } else {
    if (!hasContactEmail) {
      issues.push(issue("no-email", "No email", "info"));
    }
    if (!hasContactPhone) {
      issues.push(issue("no-phone", "No phone", "info"));
    }
  }
  if (
    !hasValue(vendor.address) ||
    !hasValue(vendor.city) ||
    !hasValue(vendor.state) ||
    !hasValue(vendor.zip_code)
  ) {
    issues.push(issue("incomplete-address", "Incomplete address", "info"));
  }
  if (!hasValue(vendor.payment_method) && !hasValue(vendor.terms)) {
    issues.push(issue("no-payment-terms", "No payment terms"));
  }
  if (!hasValue(vendor.acumatica_vendor_id)) {
    issues.push(issue("no-erp-id", "No ERP ID", "info"));
  }

  return issues;
}

export function formatDataQualitySummary(
  issues: DirectoryDataQualityIssue[],
): string {
  if (issues.length === 0) {
    return "Ready";
  }

  return issues.map((issue) => issue.label).join(", ");
}
