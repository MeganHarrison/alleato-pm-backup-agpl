const NON_PROJECT_APPLICABLE_PATTERNS = [
  /\bread\.ai\b/i,
  /\bnotetaker\b/i,
  /\bmeeting recorder\b/i,
  /\bmeeting recording\b/i,
  /\btranscript is ready\b/i,
  /\bjoined your meeting\b/i,
  /\bundeliverable\b/i,
  /\becoshield pest solutions?\b/i,
  /\bpest solutions?\b/i,
  /\bfishing trip\b/i,
  /\bamazon\.com\/checkout\b/i,
  /\binsulation4less\.com\b/i,
  /\bhandcrafted hose co\b/i,
  /\bprotection for automatic storage and retrieval systems\b/i,
  /\bi was so shocked\b/i,
  /\bdrone broken\b/i,
  /\bpractice hours\b/i,
  /\bcanceled:\s*/i,
  /\bcancelled:\s*/i,
];

const MULTI_PROJECT_PATTERNS = [
  /\bweekly huddle\b/i,
  /\boac meeting\b/i,
  /\bhuddle agenda\b/i,
  /\bdaily agenda\b/i,
  /\bsprinkler division\s+[–-]\s+daily huddle\b/i,
  /\bweekly touch base\b/i,
];

const INTERNAL_PROJECT_PATTERNS = [
  /\btimesheets?\b/i,
  /\btimecards?\b/i,
  /\bsalary\b/i,
  /\bpto\b/i,
  /\bpayroll\b/i,
  /\be-payroll\b/i,
  /\bhealth insurance\b/i,
  /\boperating agreement\b/i,
  /\bteam strategy\b/i,
  /\bcompany announcements?\b/i,
  /\bindiana office\b/i,
  /\blunch\b/i,
  /\bcredit card\b/i,
  /\bbill\.com\b/i,
  /\bvendor\b/i,
  /\blaptop\b/i,
  /\binterview\b/i,
  /\bpaternity leave\b/i,
  /\byearly review\b/i,
  /\bcancellations\b/i,
  /\bpolicy #\d/i,
  /\bgathering content for marketing\b/i,
  /\bpending invoices in notion\b/i,
  /\btransaction coding\b/i,
  /\bbusiness trust\b/i,
  /\btrust funding\b/i,
  /\btrust governance\b/i,
  /\btrust income\b/i,
  /\bextraordinary dividends?\b/i,
  /\bholding company\b/i,
  /\bmanagement service agreements?\b/i,
  /\btax compliance\b/i,
];

const PROJECT_SIGNAL_PATTERNS = [
  /\brfi\b/i,
  /\bsubmittal\b/i,
  /\bchange order\b/i,
  /\bchange event\b/i,
  /\bpay app\b/i,
  /\binvoice\b/i,
  /\bdrawings?\b/i,
  /\bpermit\b/i,
  /\bbid set\b/i,
  /\bpricing\b/i,
  /\bcompleted service\b/i,
  /\bsprinkler\b/i,
  /\bpenetration\b/i,
];

function firstPatternMatch(text, patterns) {
  return patterns.find((pattern) => pattern.test(text))?.source ?? null;
}

export function classifyProjectApplicability(row = {}) {
  const title = String(row.title ?? row.source_title ?? "");
  const category = String(row.category ?? "");
  const type = String(row.type ?? "");
  const family = String(row.source_family ?? "");
  const status = String(row.status ?? "");
  const textSample = String(row.text_sample ?? row.textSample ?? "");
  const haystack = [title, category, type, family, textSample].join("\n");

  if (row.project_id !== null && row.project_id !== undefined) {
    return {
      project_applicability: "single_project",
      project_required: true,
      project_applicability_reason: "source_has_project_id",
    };
  }

  if (
    family === "teams" &&
    /^teams dm conversation:\s*19:/i.test(title) &&
    textSample.trim().length === 0
  ) {
    return {
      project_applicability: "not_project_applicable",
      project_required: false,
      project_applicability_reason: "teams_anonymized_thread_has_no_extractable_text",
    };
  }

  if (status === "skipped_low_content") {
    return {
      project_applicability: "not_project_applicable",
      project_required: false,
      project_applicability_reason: "terminal_status_skipped_low_content",
    };
  }

  const nonProjectPattern = firstPatternMatch(haystack, NON_PROJECT_APPLICABLE_PATTERNS);
  if (nonProjectPattern) {
    return {
      project_applicability: "not_project_applicable",
      project_required: false,
      project_applicability_reason: `matched_non_project_pattern:${nonProjectPattern}`,
    };
  }

  const multiProjectPattern = firstPatternMatch(haystack, MULTI_PROJECT_PATTERNS);
  if (multiProjectPattern) {
    return {
      project_applicability: "multi_project_review",
      project_required: false,
      project_applicability_reason: `matched_multi_project_pattern:${multiProjectPattern}`,
    };
  }

  const internalPattern = firstPatternMatch(haystack, INTERNAL_PROJECT_PATTERNS);
  if (internalPattern) {
    return {
      project_applicability: "internal_project",
      project_required: false,
      project_applicability_reason: `matched_internal_pattern:${internalPattern}`,
    };
  }

  const projectSignalPattern = firstPatternMatch(haystack, PROJECT_SIGNAL_PATTERNS);
  if (projectSignalPattern) {
    return {
      project_applicability: "project_assignment_review",
      project_required: true,
      project_applicability_reason: `matched_project_signal_pattern:${projectSignalPattern}`,
    };
  }

  return {
    project_applicability: "project_assignment_review",
    project_required: true,
    project_applicability_reason: "no_project_id_and_no_exclusion_pattern",
  };
}

export function isProjectRequired(applicability) {
  return applicability === "single_project" || applicability === "project_assignment_review";
}
