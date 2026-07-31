"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bot,
  Braces,
  Database,
  FileText,
  FolderCog,
  Map,
  PanelsTopLeft,
  ServerCog,
  ShieldCheck,
} from "lucide-react";

import { File, Folder, Tree } from "@/components/ui/file-tree";
import { Heading } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  SplitPage,
  SplitPageFrame,
  useSplitPage,
} from "@/components/ui/split-page";
import { cn } from "@/lib/utils";

import {
  architectureGuardrails,
  architectureLayerById,
  architectureScreenshots,
  type ArchitectureLayerId,
} from "./architecture-explorer-data";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
} from "../workspace-primitives";

const treeItems: Array<{
  id: ArchitectureLayerId;
  label: string;
  icon: ReactNode;
}> = [
  { id: "routes", label: "src/app/", icon: <PanelsTopLeft className="size-4" /> },
  {
    id: "shared-ui",
    label: "src/components/",
    icon: <Braces className="size-4" />,
  },
  { id: "ai-runtime", label: "src/lib/ai/", icon: <Bot className="size-4" /> },
  {
    id: "services",
    label: "src/services/",
    icon: <ServerCog className="size-4" />,
  },
  { id: "database", label: "migrations/", icon: <Database className="size-4" /> },
  { id: "project-map", label: "PROJECT-MAP.md", icon: <Map className="size-4" /> },
  {
    id: "table-metadata",
    label: "tables.yaml",
    icon: <FileText className="size-4" />,
  },
  {
    id: "verification",
    label: "verification/",
    icon: <ShieldCheck className="size-4" />,
  },
  {
    id: "publishing",
    label: "codex-finish.mjs",
    icon: <FolderCog className="size-4" />,
  },
];

function ArchitectureTreeItem({
  id,
  label,
  icon,
  selectedId,
  onSelect,
}: (typeof treeItems)[number] & {
  selectedId: ArchitectureLayerId;
  onSelect: (id: ArchitectureLayerId) => void;
}) {
  const selected = selectedId === id;

  return (
    <File
      value={id}
      handleSelect={() => onSelect(id)}
      isSelect={selected}
      fileIcon={icon}
      aria-label={`Select ${architectureLayerById[id].title.toLowerCase()}`}
      aria-pressed={selected}
      aria-controls="architecture-layer-inspector"
      className={cn(
        "min-h-9 w-full px-2 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        selected && "bg-muted text-foreground",
      )}
    >
      <span className="font-mono text-xs">{label}</span>
    </File>
  );
}

function ArchitectureTreePane({
  selectedId,
  onSelect,
}: {
  selectedId: ArchitectureLayerId;
  onSelect: (id: ArchitectureLayerId) => void;
}) {
  const { isDesktop, onClose } = useSplitPage();
  const item = (id: ArchitectureLayerId) =>
    treeItems.find((treeItem) => treeItem.id === id)!;
  const selectLayer = (id: ArchitectureLayerId) => {
    onSelect(id);
    if (!isDesktop) onClose();
  };

  return (
    <div className="h-full min-h-96 bg-muted/30 py-4">
      <div className="px-4 pb-3">
        <p className="font-mono text-xs text-muted-foreground">
          alleato-pm/
        </p>
      </div>
      <Tree
        initialSelectedId="routes"
        initialExpandedItems={[
          "frontend",
          "backend",
          "supabase",
          "architecture-docs",
          "guardrail-scripts",
        ]}
        sort="none"
        className="h-full px-2"
      >
        <Folder value="frontend" element="frontend/">
          {(["routes", "shared-ui", "ai-runtime"] as const).map((id) => (
            <ArchitectureTreeItem
              key={id}
              {...item(id)}
              selectedId={selectedId}
              onSelect={selectLayer}
            />
          ))}
        </Folder>
        <Folder value="backend" element="backend/">
          <ArchitectureTreeItem
            {...item("services")}
            selectedId={selectedId}
            onSelect={selectLayer}
          />
        </Folder>
        <Folder value="supabase" element="supabase/">
          <ArchitectureTreeItem
            {...item("database")}
            selectedId={selectedId}
            onSelect={selectLayer}
          />
        </Folder>
        <Folder value="architecture-docs" element="docs/architecture/">
          {(["project-map", "table-metadata"] as const).map((id) => (
            <ArchitectureTreeItem
              key={id}
              {...item(id)}
              selectedId={selectedId}
              onSelect={selectLayer}
            />
          ))}
        </Folder>
        <Folder value="guardrail-scripts" element="scripts/">
          {(["verification", "publishing"] as const).map((id) => (
            <ArchitectureTreeItem
              key={id}
              {...item(id)}
              selectedId={selectedId}
              onSelect={selectLayer}
            />
          ))}
        </Folder>
      </Tree>
    </div>
  );
}

function ArchitectureInspector({ selectedId }: { selectedId: ArchitectureLayerId }) {
  const selectedLayer = architectureLayerById[selectedId];
  const { isDesktop, onOpen } = useSplitPage();

  return (
    <section
      id="architecture-layer-inspector"
      aria-live="polite"
      className="min-h-96 p-6 sm:p-8"
    >
      {!isDesktop ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          className="mb-6 -ml-3 min-h-11 gap-2 px-3 text-xs text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to codebase map
        </Button>
      ) : null}

      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Selected path
      </p>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {selectedLayer.path}
      </p>
      <Heading
        level={4}
        as="h3"
        className="mt-3 text-2xl font-semibold tracking-tight text-foreground"
      >
        {selectedLayer.title}
      </Heading>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {selectedLayer.summary}
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Boundary
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">
            {selectedLayer.boundary}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Examples
          </p>
          <ul className="mt-3 divide-y divide-border/60">
            {selectedLayer.examples.map((example) => (
              <li
                key={example}
                className="py-2 font-mono text-xs text-foreground/80 first:pt-0"
              >
                {example}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <CanonicalLink href={selectedLayer.sourceHref}>
          {selectedLayer.sourceLabel}
        </CanonicalLink>
        <code className="font-mono text-xs text-muted-foreground">
          {selectedLayer.check}
        </code>
      </div>
    </section>
  );
}

export function ArchitectureAssurancePreview() {
  const [selectedId, setSelectedId] = useState<ArchitectureLayerId>("routes");

  return (
    <div className="space-y-12 pb-16">
      <WorkspacePageIntro
        eyebrow="Project architecture"
        title="How the system is built, and how it stays organized."
        statusLabel="Read-only architecture guide"
      >
        Select a repository path to see what it owns, what stays outside its
        boundary, and which check prevents it from drifting. Direct file deletion
        bypasses those protections.
      </WorkspacePageIntro>

      <WorkspaceSection
        showHeader={false}
        showTopDivider={false}
      >
        <SplitPageFrame
          height="fill"
          className="min-h-96 rounded-lg border border-border bg-background"
        >
          <SplitPage
            variant="two-column"
            breakpoint="lg"
            firstPaneWidth="40%"
            defaultIsOpen
            className="min-h-96"
            firstPaneClassName="border-border lg:border-r"
          >
            <ArchitectureTreePane
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <ArchitectureInspector selectedId={selectedId} />
          </SplitPage>
        </SplitPageFrame>
      </WorkspaceSection>

      <WorkspaceSection
        title="What this structure produces"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          {architectureScreenshots.map((screenshot) => (
            <figure key={screenshot.src}>
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={screenshot.src}
                  alt={screenshot.alt}
                  width={1280}
                  height={800}
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="mt-4">
                <Heading
                  level={5}
                  as="h3"
                  className="text-sm font-semibold text-foreground"
                >
                  {screenshot.title}
                </Heading>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {screenshot.description}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="Organization is maintained by the process, not manual cleanup"
        action={
          <CanonicalLink href="/ai-dashboard/architecture/changes">
            View accepted changes
          </CanonicalLink>
        }
      >
        <div className="divide-y divide-border">
          {architectureGuardrails.map((guardrail) => (
            <div
              key={guardrail.step}
              className="grid gap-3 py-5 first:pt-0 sm:grid-cols-12 sm:gap-6"
            >
              <p className="font-mono text-xs text-primary sm:col-span-1">
                {guardrail.step}
              </p>
              <div className="sm:col-span-4">
                <Heading
                  level={5}
                  as="h3"
                  className="text-sm font-semibold text-foreground"
                >
                  {guardrail.title}
                </Heading>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-5">
                {guardrail.description}
              </p>
              <p className="font-mono text-xs text-muted-foreground sm:col-span-2 sm:text-right">
                {guardrail.evidence}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">
            The safe path is request, owner, checks, review, then exact-file
            publication. Direct repository cleanup skips the steps that reveal
            downstream impact.
          </p>
          <CanonicalLink href="https://alleato-docs-site.vercel.app/architecture/overview">
            Open detailed Architecture Center
          </CanonicalLink>
        </div>
      </WorkspaceSection>
    </div>
  );
}
