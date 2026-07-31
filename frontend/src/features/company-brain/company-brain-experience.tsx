"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  FileChartColumn,
  FileText,
  Lightbulb,
  ListTree,
  Network,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import { WorkspacePageIntro } from "@/app/(main)/ai-dashboard/workspace-primitives";
import { DetailField, Heading } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import aiOsStyles from "@/app/(main)/ai-dashboard/ai-os/ai-os.module.css";
import type {
  BrainEntityKind,
  BrainRange,
  CompanyBrainNode,
  CompanyBrainOverview,
} from "./company-brain-contract";
import { isBrainFocus } from "./company-brain-contract";
import { captureCompanyBrain } from "./company-brain-telemetry";
import styles from "./company-brain.module.css";

const STATUS_LABELS = {
  healthy: "Healthy",
  syncing: "Syncing",
  warning: "Needs attention",
  error: "Unavailable",
  paused: "Paused",
  unknown: "Unknown",
} as const;

const LAYER_LABELS: Record<BrainEntityKind, string> = {
  source: "Sources",
  brain: "Company Brain",
  domain: "Knowledge domains",
  agent: "Agents",
  outcome: "Outcomes",
};

const BRAND_ICONS: Record<string, string> = {
  fireflies: "/company-brain/fireflies.svg",
  outlook: "/company-brain/outlook.svg",
  teams: "/company-brain/teams.svg",
  sharepoint: "/company-brain/sharepoint.svg",
  onedrive: "/company-brain/onedrive.svg",
};

const OUTPUT_ICONS = {
  "executive-brief": FileText,
  "project-intelligence": ChartNoAxesCombined,
  tasks: FileChartColumn,
  risks: TriangleAlert,
  "change-events": RefreshCw,
  opportunities: Lightbulb,
};

const OUTPUT_ICON_TONES: Record<string, string> = {
  "executive-brief": styles.iconViolet,
  "project-intelligence": styles.iconBlue,
  tasks: styles.iconOrange,
  risks: styles.iconRed,
  "change-events": styles.iconPurple,
  opportunities: styles.iconGreen,
};

const SOURCE_LANES = [
  "#a669ff",
  "#3fa9ff",
  "#715dff",
  "#37d4d1",
  "#3388ff",
] as const;
const OUTPUT_LANES = [
  "#a669ff",
  "#3fa9ff",
  "#ff9b3f",
  "#ff6582",
  "#b06cff",
  "#6bd890",
] as const;

const RANGE_LABELS: Record<BrainRange, string> = {
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
};

function focusValue(node: CompanyBrainNode): string {
  return `${node.kind}:${node.id}`;
}

function formatRelative(iso: string | null, referenceIso: string): string {
  if (!iso) return "No recent activity";
  const difference = new Date(referenceIso).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(difference)) return "Freshness unknown";
  const minutes = Math.max(0, Math.round(difference / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function focusVisibleNode(key: string): void {
  const buttons =
    document.querySelectorAll<HTMLButtonElement>("[data-brain-focus]");
  [...buttons]
    .find(
      (button) =>
        button.dataset.brainFocus === key &&
        button.getClientRects().length > 0 &&
        !button.disabled,
    )
    ?.focus();
}

function StatusDot({ status }: { status: CompanyBrainNode["status"] }) {
  return (
    <span
      className={cn(styles.statusDot, styles[`status_${status}`])}
      aria-hidden="true"
    />
  );
}

function EntityButton({
  node,
  selected,
  dimmed = false,
  testId,
  onSelect,
  onMove,
}: {
  node: CompanyBrainNode;
  selected: boolean;
  dimmed?: boolean;
  testId?: string;
  onSelect: (node: CompanyBrainNode) => void;
  onMove?: (node: CompanyBrainNode, direction: -1 | 1) => void;
}) {
  const nameIconKey = node.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sourceIconKey =
    nameIconKey === "microsoftteams" ? "teams" : nameIconKey;
  const brandIcon =
    node.kind === "brain"
      ? "/company-brain/alleato-mark.png"
      : node.kind === "source"
        ? BRAND_ICONS[sourceIconKey]
        : null;
  const Icon =
    OUTPUT_ICONS[node.id as keyof typeof OUTPUT_ICONS] ??
    (node.kind === "agent" ? Bot : Sparkles);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onMove) return;
    if (["ArrowDown", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      onMove(node, 1);
    } else if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
      onMove(node, -1);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      data-brain-focus={focusValue(node)}
      data-testid={testId ?? `brain-node-${node.kind}-${node.id}`}
      className={cn(
        styles.entityButton,
        selected && styles.entitySelected,
        dimmed && styles.entityDimmed,
      )}
      aria-pressed={selected}
      aria-label={`${node.name}, ${STATUS_LABELS[node.status]}${
        node.count === null
          ? ""
          : `, ${node.count} ${node.countLabel ?? "items"}`
      }`}
      onClick={() => onSelect(node)}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          styles.entityIcon,
          brandIcon ? styles.brandIcon : OUTPUT_ICON_TONES[node.id],
        )}
      >
        {brandIcon ? (
          <Image
            src={brandIcon}
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            unoptimized
          />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <span className={styles.entityCopy}>
        <strong>{node.name}</strong>
        <small>{node.description}</small>
      </span>
      <span className={styles.entityMeasure}>
        {node.count === null ? "—" : node.count.toLocaleString()}
        <StatusDot status={node.status} />
      </span>
    </Button>
  );
}

/**
 * The brain is the page's focal point and renders in both the desktop and the
 * mobile map, so it lives here rather than being duplicated. Only one of the
 * two is ever visible; the mobile copy carries its own test id so selectors
 * stay unambiguous.
 */
function BrainButton({
  brain,
  selected,
  interactive,
  onSelect,
  testId,
}: {
  brain: CompanyBrainNode;
  selected: boolean;
  interactive: boolean;
  onSelect: (node: CompanyBrainNode) => void;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(styles.brainButton, selected && styles.brainSelected)}
      data-brain-focus={focusValue(brain)}
      data-testid={testId ?? `brain-node-${brain.kind}-${brain.id}`}
      aria-pressed={selected}
      disabled={!interactive}
      onClick={() => onSelect(brain)}
    >
      <span className={styles.brainVisual} aria-hidden="true">
        <Image
          src="/company-brain/neural-brain.webp"
          alt=""
          width={1024}
          height={683}
          priority
          className={styles.brainImage}
        />
        <span className={styles.brainMark}>
          <Image
            src="/company-brain/alleato-mark.png"
            alt=""
            width={52}
            height={38}
            priority
          />
        </span>
      </span>
      <span className="sr-only">
        Company Brain, permission-scoped intelligence
      </span>
    </Button>
  );
}

function KnowledgeMap({
  nodes,
  selected,
  searchIds,
  motionPaused,
  interactive,
  onSelect,
  onMove,
}: {
  nodes: CompanyBrainNode[];
  selected: CompanyBrainNode | null;
  searchIds: Set<string>;
  motionPaused: boolean;
  interactive: boolean;
  onSelect: (node: CompanyBrainNode) => void;
  onMove: (node: CompanyBrainNode, direction: -1 | 1) => void;
}) {
  const sources = nodes.filter((node) => node.kind === "source");
  const brain = nodes.find((node) => node.kind === "brain");
  const outputs = nodes.filter(
    (node) => node.kind === "agent" || node.kind === "outcome",
  );

  return (
    <div
      className={cn(styles.knowledgeMap, motionPaused && styles.motionPaused)}
      data-testid="company-brain-map"
      aria-label="Knowledge flow system map"
    >
      <div className={styles.mapColumn}>
        <p className={styles.columnLabel}>Ingestion sources</p>
        <div className={styles.entityStack}>
          {sources.map((node) => (
            <EntityButton
              key={node.id}
              node={node}
              selected={selected?.id === node.id}
              dimmed={searchIds.size > 0 && !searchIds.has(node.id)}
              onSelect={onSelect}
              onMove={onMove}
            />
          ))}
        </div>
      </div>

      <div className={styles.brainStage}>
        <svg
          className={styles.flowLines}
          viewBox="0 0 520 380"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter
              id="company-brain-glow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[72, 128, 184, 240, 296].map((y, index) => (
            <path
              key={`in-${y}`}
              d={`M 0 ${y} C 120 ${y}, 125 ${190 + (index - 2) * 10}, 245 190`}
              style={{ "--lane-color": SOURCE_LANES[index] } as CSSProperties}
            />
          ))}
          {[62, 112, 162, 212, 262, 312].map((y, index) => (
            <path
              key={`out-${y}`}
              d={`M 275 190 C 390 ${190 + (index - 2.5) * 9}, 400 ${y}, 520 ${y}`}
              style={{ "--lane-color": OUTPUT_LANES[index] } as CSSProperties}
            />
          ))}
        </svg>
        {brain ? (
          <BrainButton
            brain={brain}
            selected={selected?.id === brain.id}
            interactive={interactive}
            onSelect={onSelect}
          />
        ) : null}
      </div>

      <div className={styles.mapColumn}>
        <p className={styles.columnLabel}>Intelligence outputs</p>
        <div className={styles.entityStack}>
          {outputs.map((node) => (
            <EntityButton
              key={node.id}
              node={node}
              selected={selected?.id === node.id}
              dimmed={searchIds.size > 0 && !searchIds.has(node.id)}
              onSelect={onSelect}
              onMove={onMove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TextMap({
  nodes,
  selected,
  onSelect,
}: {
  nodes: CompanyBrainNode[];
  selected: CompanyBrainNode | null;
  onSelect: (node: CompanyBrainNode) => void;
}) {
  const groups: Array<[string, CompanyBrainNode[]]> = [
    ["Sources", nodes.filter((node) => node.kind === "source")],
    ["Company Brain", nodes.filter((node) => node.kind === "brain")],
    [
      "Intelligence outputs",
      nodes.filter((node) => node.kind === "agent" || node.kind === "outcome"),
    ],
  ];
  return (
    <div className={styles.textMap} data-testid="company-brain-text-map">
      <p className="sr-only">
        Accessible system map. {nodes.length} visible entities.
      </p>
      {groups.map(([label, group]) => (
        <section
          key={label}
          aria-labelledby={`map-${label.replaceAll(" ", "-")}`}
        >
          <Heading level={3} as="h3" id={`map-${label.replaceAll(" ", "-")}`}>
            {label}
          </Heading>
          <ul>
            {group.map((node) => (
              <li key={node.id}>
                <Button
                  type="button"
                  variant="ghost"
                  data-brain-focus={focusValue(node)}
                  aria-pressed={selected?.id === node.id}
                  onClick={() => onSelect(node)}
                >
                  <span>{node.name}</span>
                  <span>
                    {STATUS_LABELS[node.status]}
                    {node.count === null
                      ? ""
                      : ` · ${node.count.toLocaleString()}`}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Mobile keeps the same sources → brain → outputs story as the desktop map,
 * rotated to run top-to-bottom. The brain stays the focal point and keeps its
 * flow animation; the desktop map is only hidden because its three columns
 * cannot fit, not because the diagram stops being the point on a phone.
 */
function MobileMap({
  nodes,
  selected,
  searchIds,
  motionPaused,
  interactive,
  onSelect,
  onMove,
}: {
  nodes: CompanyBrainNode[];
  selected: CompanyBrainNode | null;
  searchIds: Set<string>;
  motionPaused: boolean;
  interactive: boolean;
  onSelect: (node: CompanyBrainNode) => void;
  onMove: (node: CompanyBrainNode, direction: -1 | 1) => void;
}) {
  const sources = nodes.filter((node) => node.kind === "source");
  const brain = nodes.find((node) => node.kind === "brain");
  const outputs = nodes.filter(
    (node) => node.kind === "agent" || node.kind === "outcome",
  );
  const inLanes = [24, 100, 176, 252, 328];
  const outLanes = [16, 76, 136, 196, 256, 316];

  return (
    <div
      className={cn(styles.mobileMap, motionPaused && styles.motionPaused)}
      data-testid="company-brain-mobile-story"
      aria-label="Knowledge flow system map"
    >
      <p className={styles.columnLabel}>Ingestion sources</p>
      <div className={styles.entityStack}>
        {sources.map((node) => (
          <EntityButton
            key={node.id}
            node={node}
            selected={selected?.id === node.id}
            dimmed={searchIds.size > 0 && !searchIds.has(node.id)}
            onSelect={onSelect}
            onMove={onMove}
            testId={`mobile-brain-node-${node.kind}-${node.id}`}
          />
        ))}
      </div>

      <svg
        className={styles.mobileFlowLines}
        viewBox="0 0 352 56"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="company-brain-glow-mobile"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {inLanes.map((x, index) => (
          <path
            key={`m-in-${x}`}
            d={`M ${x} 0 C ${x} 20, 176 36, 176 56`}
            style={{ "--lane-color": SOURCE_LANES[index] } as CSSProperties}
          />
        ))}
      </svg>

      <div className={styles.mobileBrainStage}>
        {brain ? (
          <BrainButton
            brain={brain}
            selected={selected?.id === brain.id}
            interactive={interactive}
            onSelect={onSelect}
            testId={`mobile-brain-node-${brain.kind}-${brain.id}`}
          />
        ) : null}
      </div>

      <svg
        className={styles.mobileFlowLines}
        viewBox="0 0 352 56"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {outLanes.map((x, index) => (
          <path
            key={`m-out-${x}`}
            d={`M 176 0 C 176 20, ${x} 36, ${x} 56`}
            style={{ "--lane-color": OUTPUT_LANES[index] } as CSSProperties}
          />
        ))}
      </svg>

      <p className={styles.columnLabel}>Intelligence outputs</p>
      <div className={styles.entityStack}>
        {outputs.map((node) => (
          <EntityButton
            key={node.id}
            node={node}
            selected={selected?.id === node.id}
            dimmed={searchIds.size > 0 && !searchIds.has(node.id)}
            onSelect={onSelect}
            onMove={onMove}
            testId={`mobile-brain-node-${node.kind}-${node.id}`}
          />
        ))}
      </div>
    </div>
  );
}

function InspectorContent({
  node,
  generatedAt,
  closeRef,
  onClose,
}: {
  node: CompanyBrainNode;
  generatedAt: string;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  return (
    <div className={styles.inspectorContent}>
      <div className={styles.inspectorToolbar}>
        <span>
          <StatusDot status={node.status} />
          {STATUS_LABELS[node.status]}
        </span>
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div>
        <p className={styles.inspectorKind}>{LAYER_LABELS[node.kind]}</p>
        <Heading level={2} className={styles.inspectorTitle}>
          {node.name}
        </Heading>
        <p className={styles.inspectorDescription}>{node.description}</p>
      </div>
      <div className={styles.inspectorFacts}>
        <DetailField label="Freshness">
          {formatRelative(node.lastActivityAt, generatedAt)}
        </DetailField>
        <DetailField label="Volume">
          {node.count === null
            ? "Unavailable"
            : `${node.count.toLocaleString()} ${node.countLabel ?? "items"}`}
        </DetailField>
        <DetailField label="Access">Permitted</DetailField>
      </div>
      {node.href && node.permissions.canNavigate ? (
        <Button asChild variant="outline" className="w-full justify-between">
          <Link href={node.href}>
            Open detail <ArrowRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <p className={styles.inspectorUnavailable}>
          No canonical detail route is available.
        </p>
      )}
    </div>
  );
}

function EntityInspector({
  node,
  generatedAt,
  compact,
  closeRef,
  onClose,
  onRestoreFocus,
}: {
  node: CompanyBrainNode | null;
  generatedAt: string;
  compact: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  if (compact) {
    return (
      <Sheet open={Boolean(node)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={styles.inspectorSheet}
          data-testid="entity-inspector"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          {node ? (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{node.name}</SheetTitle>
                <SheetDescription>{node.description}</SheetDescription>
              </SheetHeader>
              <InspectorContent
                node={node}
                generatedAt={generatedAt}
                closeRef={closeRef}
                onClose={onClose}
              />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }
  return node ? (
    <aside
      className={styles.inspector}
      data-testid="entity-inspector"
      aria-label={`${node.name} details`}
    >
      <InspectorContent
        node={node}
        generatedAt={generatedAt}
        closeRef={closeRef}
        onClose={onClose}
      />
    </aside>
  ) : null;
}

function Pipeline({ live }: { live: boolean }) {
  const stages = [
    ["Parser", live ? "Live status unavailable" : "873 records"],
    ["Embedder", live ? "Live status unavailable" : "2,983 vectors"],
    ["Extractor", live ? "Live status unavailable" : "1,842 signals"],
  ];

  return (
    <div
      className={styles.pipeline}
      aria-label="Canonical pipeline stages"
      data-testid="company-brain-pipeline"
    >
      <span className={styles.pipelineTitle}>Pipeline stages</span>
      <ol>
        {stages.map(([name, value]) => (
          <li key={name}>
            <span
              className={styles.pipelineMarker}
              data-complete={live ? "false" : "true"}
              aria-hidden="true"
            >
              {live ? null : <Check className="size-3" />}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{value}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ActivityFeed({ overview }: { overview: CompanyBrainOverview }) {
  return (
    <section
      className={styles.activityPanel}
      aria-labelledby="activity-feed-title"
    >
      <div className={styles.moduleHeading}>
        <Heading level={3} as="h2" id="activity-feed-title">
          Live activity feed
        </Heading>
      </div>
      {overview.activity.length ? (
        <ol className={styles.activityFeed}>
          {overview.activity.slice(0, 8).map((item) => (
            <li key={item.id} data-testid={`activity-event-${item.id}`}>
              <time dateTime={item.occurredAt}>
                {formatRelative(item.occurredAt, overview.generatedAt)}
              </time>
              <span className={styles.activityIcon}>
                {item.type === "task" ? <Check /> : <FileText />}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <em>{item.entityRef.name}</em>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.moduleEmpty}>
          No permitted activity in this range.
        </p>
      )}
    </section>
  );
}

/**
 * A metric with `value: null` is one the system cannot authoritatively measure
 * yet. It renders its reason instead of a number — never a fabricated value,
 * placeholder trendline, or dash.
 */
function MetricRail({
  overview,
  range,
}: {
  overview: CompanyBrainOverview;
  range: BrainRange;
}) {
  const metric = (key: string) =>
    overview.metrics.find((item) => item.key === key);
  const live = overview.mode === "live" || overview.permissionLimited;
  const windowLabel = RANGE_LABELS[range];
  const values: Array<{
    label: string;
    value: string | null;
    context: string;
    positive?: boolean;
  }> = [
    {
      label: "Sources connected",
      value: live ? (metric("connected_sources")?.displayValue ?? null) : "573",
      context: live
        ? (metric("connected_sources")?.context ?? "Not measured")
        : "+18% vs previous window",
      positive: !live,
    },
    {
      label: "Knowledge chunks",
      value: live ? null : "12,846",
      context: live ? "Not measured" : "+24% vs previous window",
      positive: !live,
    },
    {
      label: "AI agents active",
      value: live
        ? metric("active_agents")?.value === null
          ? null
          : (metric("active_agents")?.displayValue ?? null)
        : "12 / 15",
      context: live
        ? (metric("active_agents")?.context ?? "Not measured")
        : "Online",
      positive: !live,
    },
    {
      label: `Tasks generated (${windowLabel})`,
      value: live ? (metric("work_created")?.displayValue ?? null) : "28",
      context: live
        ? (metric("work_created")?.context ?? "Not measured")
        : "+27% vs previous window",
      positive: !live,
    },
    {
      label: "Risks identified",
      value: live ? null : "17",
      context: live ? "Not measured" : "+13% vs previous window",
      positive: !live,
    },
    {
      label: "Opportunities",
      value: live ? null : "9",
      context: live ? "Not measured" : "+29% vs previous window",
      positive: !live,
    },
  ];
  return (
    <section
      className={styles.metricRail}
      aria-label="System monitoring metrics"
    >
      {values.map((item) => (
        <article
          key={item.label}
          className={styles.metricModule}
          aria-label={item.label}
        >
          <p className={styles.metricLabel}>{item.label}</p>
          {item.value === null ? (
            <p className={styles.metricUnmeasured}>{item.context}</p>
          ) : (
            <>
              <strong className={styles.metricValue}>{item.value}</strong>
              {item.context ? (
                <span
                  className={cn(
                    styles.metricContext,
                    item.positive && styles.metricContextPositive,
                  )}
                >
                  {item.context}
                </span>
              ) : null}
            </>
          )}
        </article>
      ))}
    </section>
  );
}

export function CompanyBrainExperience({
  initialOverview,
  range,
}: {
  initialOverview: CompanyBrainOverview;
  range: BrainRange;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/ai/company-brain";
  const rawSearchParams = useSearchParams();
  const searchParamString = rawSearchParams?.toString() ?? "";
  const searchParams = useMemo(
    () => new URLSearchParams(searchParamString),
    [searchParamString],
  );
  const compactInspector = useMediaQuery("(max-width: 1023px)");
  const [overview, setOverview] = useState(initialOverview);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [view, setView] = useState<"map" | "list">("map");
  const [motionPaused, setMotionPaused] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<string | null>(null);
  const previousFocusRef = useRef<string | null>(null);

  useEffect(() => setOverview(initialOverview), [initialOverview]);
  useEffect(() => setInteractive(true), []);
  useEffect(() => {
    captureCompanyBrain({
      event: "company_brain_loaded",
      properties: { state: initialOverview.state, range },
    });
  }, [initialOverview.state, range]);

  const nodes = useMemo(
    () => overview.nodes.filter((node) => node.permissions.canView),
    [overview.nodes],
  );
  const currentFocus = searchParams.get("focus");
  const selected = useMemo(
    () =>
      isBrainFocus(currentFocus)
        ? (nodes.find((node) => focusValue(node) === currentFocus) ?? null)
        : null,
    [currentFocus, nodes],
  );

  const updateParams = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      mode: "push" | "replace" = "replace",
      serverNavigation = false,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const next = params.toString();
      const nextUrl = next ? `${pathname}?${next}` : pathname;

      if (serverNavigation) {
        router[mode](nextUrl, { scroll: false });
        return;
      }

      window.history[mode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        nextUrl,
      );
    },
    [pathname, router, searchParams],
  );

  const selectNode = useCallback(
    (node: CompanyBrainNode) => {
      returnFocusRef.current = focusValue(node);
      updateParams((params) => params.set("focus", focusValue(node)), "push");
      captureCompanyBrain({
        event: "company_brain_node_selected",
        properties: { kind: node.kind, status: node.status },
      });
    },
    [updateParams],
  );

  const closeInspector = useCallback(() => {
    updateParams((params) => params.delete("focus"), "replace");
    const key = returnFocusRef.current;
    if (key) window.setTimeout(() => focusVisibleNode(key), 0);
  }, [updateParams]);

  useEffect(() => {
    if (currentFocus && !selected)
      updateParams((params) => params.delete("focus"));
  }, [currentFocus, selected, updateParams]);

  useEffect(() => {
    if (selected) {
      previousFocusRef.current = focusValue(selected);
      window.setTimeout(() => closeRef.current?.focus(), 0);
    } else if (previousFocusRef.current) {
      const key = previousFocusRef.current;
      previousFocusRef.current = null;
      window.setTimeout(() => focusVisibleNode(key), 0);
    }
  }, [selected]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && selected) closeInspector();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeInspector, selected]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      normalizedQuery
        ? nodes.filter((node) =>
            `${node.name} ${node.description}`
              .toLowerCase()
              .includes(normalizedQuery),
          )
        : nodes,
    [nodes, normalizedQuery],
  );
  const searchIds = useMemo(
    () => new Set(matches.map((node) => node.id)),
    [matches],
  );

  const moveNode = useCallback(
    (node: CompanyBrainNode, direction: -1 | 1) => {
      const peers = nodes.filter((candidate) => candidate.kind === node.kind);
      const current = peers.findIndex((candidate) => candidate.id === node.id);
      const target = peers[(current + direction + peers.length) % peers.length];
      // Desktop and mobile both render the node, so resolve by visibility
      // rather than a ref map whose entries the hidden map would clobber.
      if (target) focusVisibleNode(focusValue(target));
    },
    [nodes],
  );

  if (overview.state === "error") {
    return (
      <main
        className={cn(aiOsStyles.root, styles.root)}
        data-testid="company-brain-experience"
        data-hydrated={interactive ? "true" : "false"}
      >
        <WorkspacePageIntro compact title="Company Brain">
          Real-time view of your organizational knowledge system
        </WorkspacePageIntro>
        <Alert variant="destructive" role="alert" className="mt-8">
          <AlertTitle>Company Brain is unavailable</AlertTitle>
          <AlertDescription>
            The permission-scoped overview failed. Retry before acting on system
            health.
          </AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => router.refresh()}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </main>
    );
  }

  return (
    <main
      className={cn(aiOsStyles.root, styles.root)}
      data-testid="company-brain-experience"
      data-hydrated={interactive ? "true" : "false"}
    >
      <WorkspacePageIntro
        compact
        title="Company Brain"
        actions={
          <div className={styles.headerActions}>
            <span
              className={styles.liveStatus}
              data-testid="company-brain-live-status"
            >
              <StatusDot status="healthy" />
              Live
            </span>
            <span
              className={styles.healthStatus}
              data-testid="company-brain-health-status"
            >
              <Activity />
              System {STATUS_LABELS[overview.health]}
            </span>
            <div className={styles.range} aria-label="Activity range">
              {(["24h", "7d", "30d"] as BrainRange[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={range === value}
                  onClick={() =>
                    updateParams(
                      (params) => params.set("range", value),
                      "replace",
                      true,
                    )
                  }
                >
                  {value.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        Real-time view of your organizational knowledge system
      </WorkspacePageIntro>

      {overview.permissionLimited ? (
        <div className={styles.permissionNotice} role="status">
          <ShieldAlert /> This view excludes entities and activity outside your
          access.
        </div>
      ) : null}

      {overview.failures.length ? (
        <Alert className="mt-5" role="status">
          <AlertTitle>Some system data is unavailable</AlertTitle>
          <AlertDescription>
            {overview.failures.map((failure) => (
              <p key={`${failure.source}:${failure.message}`}>
                <strong>{failure.source}:</strong> {failure.message}
              </p>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-4" />
              Retry unavailable data
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {overview.state === "empty" ? (
        <section className={styles.emptyState}>
          <Image
            src="/company-brain/alleato-mark.png"
            alt=""
            width={48}
            height={36}
          />
          <Heading level={2} as="h2">
            No knowledge sources yet
          </Heading>
          <p>
            The Company Brain will come online after a permitted source is
            processed.
          </p>
          <Button asChild>
            <Link href="/ai-dashboard/rag-pipeline">Review pipeline</Link>
          </Button>
        </section>
      ) : (
        <>
          <section
            className={styles.flowPanel}
            data-testid="company-brain-flow-panel"
            aria-labelledby="knowledge-flow-title"
          >
            <div className={styles.panelHeading}>
              <div>
                <Heading level={3} as="h2" id="knowledge-flow-title">
                  Knowledge flow
                </Heading>
                <p>Live knowledge graph &amp; data pipeline</p>
              </div>
              <div className={styles.mapTools}>
                <ExpandableSearch
                  value={query}
                  ariaLabel="Search Company Brain"
                  placeholder="Search system"
                  collapsible={false}
                  className={styles.mapSearch}
                  inputClassName={styles.searchInput}
                  onChange={(value) => {
                    setQuery(value);
                    updateParams((params) =>
                      value.trim()
                        ? params.set("q", value.trim())
                        : params.delete("q"),
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    view === "map"
                      ? "Show accessible text map"
                      : "Show spatial map"
                  }
                  onClick={() =>
                    setView((current) => (current === "map" ? "list" : "map"))
                  }
                >
                  {view === "map" ? <ListTree /> : <Network />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-pressed={motionPaused}
                  aria-label={motionPaused ? "Resume motion" : "Pause motion"}
                  onClick={() => setMotionPaused((value) => !value)}
                >
                  {motionPaused ? <Play /> : <Pause />}
                </Button>
              </div>
            </div>

            {normalizedQuery && !matches.length ? (
              <div className={styles.noResults} role="status">
                <CircleAlert />
                No matching system entities. Clear the search to restore the
                map.
              </div>
            ) : null}

            <div
              className={styles.desktopExperience}
              data-testid="company-brain-map-viewport"
            >
              {view === "map" ? (
                <KnowledgeMap
                  nodes={nodes}
                  selected={selected}
                  searchIds={searchIds}
                  motionPaused={motionPaused}
                  interactive={interactive}
                  onSelect={selectNode}
                  onMove={moveNode}
                />
              ) : (
                <TextMap
                  nodes={nodes}
                  selected={selected}
                  onSelect={selectNode}
                />
              )}
            </div>
            <div className={styles.mobileExperience}>
              <MobileMap
                nodes={nodes}
                selected={selected}
                searchIds={searchIds}
                motionPaused={motionPaused}
                interactive={interactive}
                onSelect={selectNode}
                onMove={moveNode}
              />
            </div>
            <Pipeline
              live={overview.mode === "live" || overview.permissionLimited}
            />
          </section>

          <MetricRail overview={overview} range={range} />

          <ActivityFeed overview={overview} />

          <section
            className={styles.insights}
            aria-labelledby="system-insights-title"
          >
            <div className={styles.insightOrb}>
              <Sparkles />
            </div>
            <div>
              <Heading level={3} as="h2" id="system-insights-title">
                System insights
              </Heading>
              <p>
                {overview.mode === "fixture" && !overview.permissionLimited
                  ? "Your knowledge system is strongest in Cost Management and Change Events. Consider improving coverage in Safety and Quality."
                  : "Insights will appear when an authoritative coverage model is connected."}
              </p>
            </div>
            <div className={styles.coverage}>
              <span>Knowledge coverage</span>
              {overview.mode === "fixture" && !overview.permissionLimited ? (
                <>
                  <strong>72%</strong>
                  <div>
                    <i style={{ width: "72%" }} />
                  </div>
                  <small>Overall permitted coverage</small>
                </>
              ) : (
                // An unmeasured value is stated quietly — never a headline
                // number over an empty progress bar.
                <p className={styles.coverageUnmeasured}>
                  Not measured — no authoritative coverage model
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <EntityInspector
        node={selected}
        generatedAt={overview.generatedAt}
        compact={compactInspector}
        closeRef={closeRef}
        onClose={closeInspector}
        onRestoreFocus={() => {
          const key = returnFocusRef.current;
          if (key) focusVisibleNode(key);
        }}
      />
      <div className="sr-only" aria-live="polite">
        {selected
          ? `${selected.name} selected. ${STATUS_LABELS[selected.status]}.`
          : "Company Brain selection cleared."}
      </div>
    </main>
  );
}
