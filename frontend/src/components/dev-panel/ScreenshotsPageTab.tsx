/* eslint-disable design-system/no-raw-heading */
"use client";

import * as React from "react";
import { stateLabel } from "@/lib/procore-route-map";

// ---------------------------------------------------------------------------
// Types — mirrors the manifest JSON shape
// ---------------------------------------------------------------------------

interface ManifestField {
  label: string;
  type?: string;
}

interface ManifestFormSection {
  title?: string;
  fields?: ManifestField[];
}

interface ManifestAction {
  label: string;
  type?: string;
}

interface ManifestState {
  id: string;
  description?: string;
  screenshot?: string;
  tabs?: Array<{ label: string }>;
  toolbarActions?: ManifestAction[];
  filters?: ManifestField[];
  rowActions?: Array<{ label: string }>;
  columns?: Array<{ label: string }>;
  columnGroups?: Array<{ label: string; columns?: Array<{ label: string }> }>;
  formSections?: ManifestFormSection[];
}

interface ManifestData {
  states?: Record<string, ManifestState>;
}

// ---------------------------------------------------------------------------
// Pill
// ---------------------------------------------------------------------------

type PillVariant = "default" | "action" | "filter" | "tab" | "column" | "field";

const PILL_COLORS: Record<PillVariant, string> = {
  default:  "bg-muted text-muted-foreground",
  tab:      "bg-teal-50 text-teal-700",
  action:   "bg-blue-50 text-blue-700",
  filter:   "bg-purple-50 text-purple-700",
  column:   "bg-muted text-muted-foreground",
  field:    "bg-amber-50 text-amber-700",
};

function Pill({ label, variant = "default" }: { label: string; variant?: PillVariant }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${PILL_COLORS[variant]}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section label inside the detail column
// ---------------------------------------------------------------------------

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One screenshot row
// ---------------------------------------------------------------------------

function ScreenshotRow({
  state,
  imgSrc,
  index,
}: {
  state: ManifestState;
  imgSrc: string;
  index: number;
}) {
  const [imgError, setImgError] = React.useState(false);
  const label = stateLabel(state.id);

  const tabs = state.tabs ?? [];
  const actions = (state.toolbarActions ?? []).filter(
    (a) =>
      // strip Procore chrome noise that isn't meaningful for our impl
      !a.label.includes("Alleato Group") &&
      !a.label.includes("Project Tools") &&
      !a.label.includes("CmdK") &&
      !a.label.includes("AppsSelect") &&
      !a.label.includes("Support & Feedback") &&
      !a.label.includes("Announcements") &&
      a.label !== "BC"
  );
  const filters = state.filters ?? [];
  const rowActions = state.rowActions ?? [];

  // Flatten columns from groups + direct columns, deduplicated
  const allColumns = [
    ...(state.columnGroups ?? []).flatMap((g) => g.columns?.map((c) => c.label) ?? []),
    ...(state.columns ?? []).map((c) => c.label),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  // Form fields
  const formFields = (state.formSections ?? []).flatMap((s) =>
    (s.fields ?? []).map((f) => ({ label: f.label, type: f.type, section: s.title }))
  );

  const hasDetails =
    tabs.length > 0 ||
    actions.length > 0 ||
    filters.length > 0 ||
    rowActions.length > 0 ||
    allColumns.length > 0 ||
    formFields.length > 0;

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${
        index > 0 ? "border-t border-border/40 pt-10" : ""
      }`}
    >
      {/* ── Left: screenshot ── */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30">
          {imgError ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Screenshot not available
            </div>
          ) : (
             
            <img
              src={imgSrc}
              alt={label}
              className="w-full object-cover object-top"
              onError={() => setImgError(true)}
              loading={index === 0 ? "eager" : "lazy"}
            />
          )}
        </div>
      </div>

      {/* ── Right: details ── */}
      <div className="space-y-5">
        {/* Name + description */}
        <div>
          <h3 className="text-base font-semibold text-foreground">{label}</h3>
          {state.description && state.description !== label && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {state.description}
            </p>
          )}
        </div>

        {!hasDetails && (
          <p className="text-xs text-muted-foreground italic">
            No spec details captured for this view.
          </p>
        )}

        {tabs.length > 0 && (
          <DetailSection title="Tabs">
            {tabs.map((t) => (
              <Pill key={t.label} label={t.label} variant="tab" />
            ))}
          </DetailSection>
        )}

        {actions.length > 0 && (
          <DetailSection title="Toolbar actions">
            {actions.map((a) => (
              <Pill key={a.label} label={a.label} variant="action" />
            ))}
          </DetailSection>
        )}

        {filters.length > 0 && (
          <DetailSection title="Filters">
            {filters.map((f) => (
              <Pill key={f.label} label={f.label} variant="filter" />
            ))}
          </DetailSection>
        )}

        {rowActions.length > 0 && (
          <DetailSection title="Row actions">
            {rowActions.map((r) => (
              <Pill key={r.label} label={r.label} variant="action" />
            ))}
          </DetailSection>
        )}

        {allColumns.length > 0 && (
          <DetailSection title="Columns">
            {allColumns.map((c) => (
              <Pill key={c} label={c} variant="column" />
            ))}
          </DetailSection>
        )}

        {formFields.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Form fields
            </p>
            <div className="space-y-2">
              {/* Group by section if multiple sections exist */}
              {(state.formSections ?? []).map((section) => (
                <div key={section.title ?? "__default"}>
                  {section.title && (
                    <p className="mb-1 text-[10px] text-muted-foreground/50 italic">
                      {section.title}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {(section.fields ?? []).map((f) => (
                      <Pill
                        key={f.label}
                        label={f.type ? `${f.label} (${f.type})` : f.label}
                        variant="field"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

interface Props {
  feature: string;
}

export function ScreenshotsPageTab({ feature }: Props) {
  const [manifest, setManifest] = React.useState<ManifestData | null>(null);
  const [stateIds, setStateIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    setManifest(null);
    setStateIds([]);

    Promise.all([
      fetch(`/api/procore-screenshots/${feature}`).then((r) => r.json()),
      fetch(`/api/dev-panel/spec/${feature}`).then((r) => r.json()),
    ])
      .then(([screenshotData, specData]) => {
        setStateIds(screenshotData.stateIds ?? []);
        setManifest({ states: specData.manifestStates ?? {} });
      })
      .catch(() => {
        setStateIds([]);
        setManifest(null);
      })
      .finally(() => setLoading(false));
  }, [feature]);

  if (loading) {
    return (
      <div className="space-y-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
            <div className="space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stateIds.length === 0) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        No screenshots found for {feature.replace(/-/g, " ")}. Run a Procore crawl to capture them.
      </div>
    );
  }

  const states = manifest?.states ?? {};

  return (
    <div className="space-y-10">
      {stateIds.map((id, index) => {
        const state: ManifestState = states[id] ?? { id };
        const imgSrc = `/api/procore-screenshots/${feature}/${id}.png`;

        return (
          <ScreenshotRow
            key={id}
            state={state}
            imgSrc={imgSrc}
            index={index}
          />
        );
      })}
    </div>
  );
}
