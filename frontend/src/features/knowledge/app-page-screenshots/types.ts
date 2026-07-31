export type ScreenshotStatus =
  | "captured"
  | "captured_http_404"
  | "captured_login_redirect"
  | "capture_error"
  | "skipped_dynamic_record"
  | "skipped_unknown_param"
  | "skipped_non_app_scope"
  | string;

export interface AppPageScreenshotResult {
  source: string;
  route: string;
  scope: string;
  included: boolean;
  tool?: string | null;
  status: ScreenshotStatus;
  urlPath?: string;
  url?: string;
  screenshot?: string;
  httpStatus?: number | null;
  finalUrl?: string;
  title?: string;
  unresolved?: string[];
  error?: string;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AppPageScreenshotManifest {
  generatedAt: string;
  baseUrl: string;
  projectId: string;
  routeSet?: string;
  storageState: string;
  totalPageRoutes: number;
  targetRoutes: number;
  summary: Record<string, number>;
  results: AppPageScreenshotResult[];
}

export interface AppPageScreenshotItem extends AppPageScreenshotResult {
  id: string;
  imageUrl: string | null;
  displayRoute: string;
  statusLabel: string;
}
