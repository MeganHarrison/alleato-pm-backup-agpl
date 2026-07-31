"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  ArrowLeft,
  Github,
  Pencil,
  Tag,
  Type,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Property, PropertyList } from "@/components/ui/property";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  SheetDescription,
} from "@/components/ui/sheet";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { useConfirm } from "@/hooks/use-confirm";
import { displayAdminFeedbackTitle } from "@/lib/admin-feedback/title";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusVariant } from "@/components/ds/status-badge";

import {
  PRIORITY_OPTIONS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "../constants";
import {
  submitterLabel,
  toDisplayStatus,
  toolLabelFromPath,
} from "../helpers";
import type { DisplayStatus, FeedbackItem, ToolOption } from "../types";

import { CollapsibleDetailSection } from "./collapsible-detail-section";
import { CommentsSection } from "./comments-section";
import { FeedbackResourcesSection } from "./feedback-resources-section";
import { GitHubActivitySection } from "./github-activity-section";
import { ToolContextSection } from "./tool-context-section";

type FeedbackSettingsTarget = "title" | "category";

export function FeedbackDetail({
  allTools,
  categoryOptions,
  item,
  updatingId,
  sendingToGitHub,
  deletingId,
  onUpdateStatus,
  onUpdateSeverity,
  onUpdateRequestType,
  onUpdateTool,
  onUpdateTitle,
  onUpdateCategory,
  onSendToGitHub,
  onDelete,
  onRefresh,
  onBack,
  commentInputRef,
}: {
  allTools: ToolOption[];
  categoryOptions: { value: string; label: string }[];
  item: FeedbackItem;
  updatingId: string | null;
  sendingToGitHub: boolean;
  deletingId: string | null;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onUpdateSeverity: (id: string, severity: "high" | "medium" | "low") => void;
  onUpdateRequestType: (id: string, requestType: string) => void;
  onUpdateTool: (id: string, toolValue: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  onSendToGitHub: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onBack?: () => void;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const displayStatus = toDisplayStatus(item.status);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] =
    useState<FeedbackSettingsTarget>("title");
  const [titleValue, setTitleValue] = useState(item.title);
  const [categoryValue, setCategoryValue] = useState(item.category ?? "");
  const { confirm: confirmDetailDelete, ConfirmDialog: DetailConfirmDialog } =
    useConfirm();
  const displayTitle = displayAdminFeedbackTitle({
    storedTitle: item.title,
    requestType: item.request_type,
    comment: item.comment,
    targetText: item.target_text,
    pageTitle: item.page_title,
  });
  const toolLabel = toolLabelFromPath(item.page_path);
  const priorityMeta = (() => {
    const severity = item.severity ?? "medium";
    if (severity === "high") {
      return {
        label: "High",
        variant: "warning" as StatusVariant,
      };
    }
    if (severity === "low") {
      return {
        label: "Low",
        variant: "neutral" as StatusVariant,
      };
    }
    return {
      label: "Medium",
      variant: "info" as StatusVariant,
    };
  })();
  const assignedToolName =
    allTools.find((tool) => tool.id === item.tool_id)?.name ?? null;
  const categorySelectValue = item.category ?? "__none__";
  const toolSelectValue = item.tool_id ? String(item.tool_id) : "unassigned";
  const statusPillTriggerClass =
    "h-auto w-auto min-w-0 border-0 bg-transparent p-0 text-sm font-normal text-foreground shadow-none focus-visible:ring-0 [&>svg:last-child]:ml-1 [&>svg:last-child]:opacity-0 [&>svg:last-child]:transition-opacity hover:[&>svg:last-child]:opacity-100 focus-visible:[&>svg:last-child]:opacity-100 data-[state=open]:[&>svg:last-child]:opacity-100";
  const propertySelectTriggerClass =
    "h-auto w-auto min-w-0 border-0 bg-transparent p-0 text-sm font-normal text-foreground shadow-none hover:bg-transparent focus-visible:ring-0 [&>svg:last-child]:opacity-0 [&>svg:last-child]:transition-opacity hover:[&>svg:last-child]:opacity-100 focus-visible:[&>svg:last-child]:opacity-100 data-[state=open]:[&>svg:last-child]:opacity-100";
  const requestTypeLabel = REQUEST_TYPE_LABELS[item.request_type] ?? item.request_type;

  useEffect(() => {
    setTitleValue(item.title);
    setCategoryValue(item.category ?? "");
  }, [item.category, item.id, item.title]);

  useEffect(() => {
    if (!settingsOpen) return;
    const targetId =
      settingsTarget === "title"
        ? `feedback-settings-title-${item.id}`
        : `feedback-settings-category-${item.id}`;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [item.id, settingsOpen, settingsTarget]);

  useEffect(() => {
    if (!lightboxImage) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxImage]);

  async function handleDeleteRequest() {
    const ok = await confirmDetailDelete({
      description: "Delete this feedback item? This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (ok) onDelete(item.id);
  }

  function openSettings(target: FeedbackSettingsTarget) {
    setSettingsTarget(target);
    setSettingsOpen(true);
  }

  return (
    <>
      {DetailConfirmDialog}
      <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 sm:px-6 lg:px-8">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-2 gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}

        {/* Header */}
        <div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="h-8 w-8"
                      aria-label="Edit feedback"
                      title="Edit feedback"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Edit feedback</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => openSettings("title")}>
                      <Type className="h-4 w-4" />
                      Edit title
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openSettings("category")}>
                      <Tag className="h-4 w-4" />
                      Edit category
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDeleteRequest()}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete item
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8"
                  aria-label="Delete feedback"
                  title="Delete feedback"
                  onClick={() => void handleDeleteRequest()}
                  disabled={deletingId === item.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-foreground">
                {displayTitle}
              </h2>
              {toolLabel ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {toolLabel}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Submitted by <span className="font-medium text-foreground">{submitterLabel(item)}</span>
                </span>
                {item.github_issue_url ? (
                  <a
                    href={item.github_issue_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Github className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">#{item.github_issue_number}</span>
                  </a>
                ) : null}
              </div>
              <div className="mt-3">
                <Select
                  value={displayStatus}
                  onValueChange={(value) =>
                    onUpdateStatus(item.id, value as DisplayStatus)
                  }
                  disabled={updatingId === item.id}
                >
                  <SelectTrigger
                    aria-label="Feedback status"
                    variant="inline"
                    size="sm"
                    className={statusPillTriggerClass}
                  >
                    <SelectValue>
                      <StatusBadge
                        status={STATUS_OPTIONS.find((option) => option.value === displayStatus)?.label ?? displayStatus}
                        className="pointer-events-none"
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <SectionRuleHeading label="Properties" />
          <div className="rounded-lg border border-border px-4">
            <PropertyList>
              <Property
                label="Priority"
                value={
                  <Select
                    value={(item.severity ?? "medium") as "high" | "medium" | "low"}
                    onValueChange={(value) =>
                      onUpdateSeverity(item.id, value as "high" | "medium" | "low")
                    }
                    disabled={updatingId === item.id}
                  >
                    <SelectTrigger
                      aria-label="Feedback priority"
                      variant="inline"
                      size="sm"
                      className={propertySelectTriggerClass}
                    >
                      <SelectValue>
                        <StatusBadge
                          status={priorityMeta.label}
                          variant={priorityMeta.variant}
                        />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <Property
                label="Category"
                value={
                  <Select
                    value={categorySelectValue}
                    onValueChange={(value) =>
                      onUpdateCategory(item.id, value === "__none__" ? null : value)
                    }
                    disabled={updatingId === item.id}
                  >
                    <SelectTrigger
                      aria-label="Feedback category"
                      variant="inline"
                      size="sm"
                      className={propertySelectTriggerClass}
                    >
                      <SelectValue>{item.category ?? "No category"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No category</SelectItem>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <Property
                label="Type"
                value={
                  <Select
                    value={item.request_type}
                    onValueChange={(value) => onUpdateRequestType(item.id, value)}
                    disabled={updatingId === item.id}
                  >
                    <SelectTrigger
                      aria-label="Feedback type"
                      variant="inline"
                      size="sm"
                      className={propertySelectTriggerClass}
                    >
                      <SelectValue>{requestTypeLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <Property
                label="Tool"
                value={
                  <Select
                    value={toolSelectValue}
                    onValueChange={(value) => onUpdateTool(item.id, value)}
                    disabled={updatingId === item.id}
                  >
                    <SelectTrigger
                      aria-label="Feedback tool"
                      variant="inline"
                      size="sm"
                      className={propertySelectTriggerClass}
                    >
                      <SelectValue>
                        <StatusBadge
                          status={assignedToolName ?? "No tool"}
                          variant="neutral"
                        />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">No tool</SelectItem>
                      {allTools.map((tool) => (
                        <SelectItem key={tool.id} value={String(tool.id)}>
                          {tool.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <Property
                label="Page"
                value={
                  <div className="flex min-w-0 flex-col gap-1">
                    <a
                      href={item.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      {item.page_path}
                    </a>
                  </div>
                }
              />
              {!item.github_issue_number ? (
                <Property
                  label="GitHub"
                  value={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSendToGitHub(item.id)}
                      disabled={sendingToGitHub}
                      className="h-auto px-0 py-0 text-sm font-normal text-foreground underline underline-offset-2 hover:bg-transparent hover:text-foreground disabled:no-underline disabled:opacity-60"
                    >
                      {sendingToGitHub ? "Creating issue" : "Create issue"}
                    </Button>
                  }
                />
              ) : null}
            </PropertyList>
          </div>
        </section>

        <section className="space-y-4">
          <SectionRuleHeading label="Description" />

          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {item.comment}
          </p>

          {item.screenshot_url && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLightboxImage(item.screenshot_url)}
              className="group block h-auto w-full overflow-hidden rounded-lg p-0 text-left transition-colors hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Open feedback screenshot"
            >
              <div className="flex max-h-128 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                <img
                  src={item.screenshot_url}
                  alt="Feedback screenshot"
                  className="h-auto max-h-128 w-full object-contain transition-opacity group-hover:opacity-95"
                />
              </div>
            </Button>
          )}
        </section>

        <section className="space-y-3">
          <CommentsSection
            feedbackItemId={item.id}
            commentInputRef={commentInputRef}
          />
        </section>

        <CollapsibleDetailSection key={`${item.id}-routing`} label="Routing">
          <ToolContextSection item={item} onAssignmentChanged={onRefresh} />
        </CollapsibleDetailSection>

        <CollapsibleDetailSection key={`${item.id}-resources`} label="Resources">
          <FeedbackResourcesSection
            item={item}
            onResourcesChanged={onRefresh}
          />
        </CollapsibleDetailSection>

        {item.github_issue_number && (
          <CollapsibleDetailSection
            key={`${item.id}-github`}
            label={`GitHub Activity #${item.github_issue_number}`}
          >
            <GitHubActivitySection issueNumber={item.github_issue_number} />
          </CollapsibleDetailSection>
        )}

        {/* Debug — tool context, page context, metadata, dangerous actions */}
        <CollapsibleDetailSection key={`${item.id}-debug`} label="Debug">
          <div className="space-y-8">
            <section className="space-y-3">
              <SectionRuleHeading label="Page Context" className="mb-0 pb-0" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">ID</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-auto rounded px-0 py-0 text-xs font-normal text-foreground transition-colors hover:bg-transparent hover:text-muted-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(item.id);
                      toast.success("ID copied to clipboard");
                    }}
                    title={`Copy full ID: ${item.id}`}
                  >
                    <code className="font-mono text-xs">{item.id}</code>
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">Page</span>
                  <a
                    href={item.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-mono text-xs text-foreground hover:underline"
                  >
                    {item.page_path}
                  </a>
                </div>
                {item.page_title && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">Title</span>
                    <span className="text-foreground">{item.page_title}</span>
                  </div>
                )}
                {item.target_text && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">Element</span>
                    <span className="truncate text-foreground">{item.target_text}</span>
                  </div>
                )}
                {item.target_selector && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">Selector</span>
                    <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {item.target_selector}
                    </code>
                  </div>
                )}
                {item.project_id && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">Project</span>
                    <span className="text-foreground">#{item.project_id}</span>
                  </div>
                )}
              </div>
            </section>

            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <section className="space-y-3">
                <SectionRuleHeading label="Source Metadata" className="mb-0 pb-0" />
                <div className="space-y-1.5">
                  {Object.entries(item.metadata as Record<string, unknown>).map(
                    ([key, value]) => {
                      const label = key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (c) => c.toUpperCase())
                        .trim();
                      const displayValue =
                        value === null || value === undefined
                          ? "—"
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value);
                      return (
                        <div key={key} className="flex items-start gap-2 text-xs">
                          <span className="w-28 shrink-0 text-muted-foreground">
                            {label}
                          </span>
                          <span className="break-all text-foreground">
                            {displayValue}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            )}

          </div>
        </CollapsibleDetailSection>
      </div>

      <SidePanel open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SidePanelContent side="right" size="md">
          <SidePanelHeader className="space-y-1">
            <SidePanelTitle>Feedback settings</SidePanelTitle>
            <SheetDescription>
              Keep the detail pane focused on review. Use this panel when you need to
              correct metadata.
            </SheetDescription>
          </SidePanelHeader>

          <SidePanelBody className="space-y-8 px-6 py-6">
            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Title</h3>
                <p className="text-sm text-muted-foreground">
                  Controls how the feedback reads in the queue and downstream issue flows.
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor={`feedback-settings-title-${item.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Title
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`feedback-settings-title-${item.id}`}
                    value={titleValue}
                    onChange={(event) => setTitleValue(event.target.value)}
                    placeholder="Edit title"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      updatingId === item.id ||
                      titleValue.trim().length === 0 ||
                      titleValue.trim() === item.title
                    }
                    onClick={() => onUpdateTitle(item.id, titleValue.trim())}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Category</h3>
                <p className="text-sm text-muted-foreground">
                  Use category only when it improves sorting, search, or triage.
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor={`feedback-settings-category-${item.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Category
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`feedback-settings-category-${item.id}`}
                    value={categoryValue}
                    onChange={(event) => setCategoryValue(event.target.value)}
                    placeholder="Add category"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      updatingId === item.id ||
                      (categoryValue.trim() || "") === (item.category ?? "")
                    }
                    onClick={() =>
                      onUpdateCategory(item.id, categoryValue.trim() || null)
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            </section>
          </SidePanelBody>
        </SidePanelContent>
      </SidePanel>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxImage(null);
            }
          }}
        >
          <img
            src={lightboxImage}
            alt="Feedback screenshot enlarged"
            className="max-h-full max-w-full object-contain"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setLightboxImage(null)}
            className="absolute right-4 top-4 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Close screenshot"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
