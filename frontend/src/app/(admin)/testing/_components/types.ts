// Shared types for the Testing section. Kept in one file so every route
// segment and component refers to the same shape.

export type SuiteType = "smoke" | "feature";

export type TestStatus = "pass" | "fail" | "skip" | "not_tested" | "fixed";

export interface Suite {
  id: string;
  tool_name: string;
  display_name: string;
  suite_type: SuiteType;
  case_count: number;
  scenario_count: number;
  feature_count: number;
  high_count: number;
}

export interface TestCase {
  id: string;
  test_number: string;
  category: string;
  subcategory: string | null;
  test_name: string;
  steps: string | null;
  setup_steps: string | null;
  context_note: string | null;
  expected_result: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  start_url: string | null;
  test_type?: string;
}

export interface TestResult {
  id: string;
  status: TestStatus;
  notes: string | null;
  severity: "critical" | "major" | "minor" | "cosmetic" | null;
  video_url: string | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_issue_state: string | null;
  test_cases: TestCase;
  test_screenshots: { id: string; public_url: string | null; label: string | null }[];
}

export interface HistoryRun {
  id: string;
  slug?: string | null;
  run_date: string;
  tester: string | null;
  environment: string | null;
  branch: string | null;
  suite_type: SuiteType;
  total: number;
  pass: number;
  fail: number;
  skip: number;
  not_tested: number;
}

export interface RunMeta {
  id: string;
  slug: string | null;
  run_date: string;
  suite: {
    tool_name: string;
    display_name: string;
    suite_type: SuiteType;
  } | null;
}
