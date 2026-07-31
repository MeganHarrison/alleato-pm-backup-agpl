"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { PageShell } from "@/components/layout";
import { ContentSectionStack, SectionAction, SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EditModeActions } from "@/components/ds/EditModeActions";
import { EmptyState } from "@/components/ds/empty-state";
import { ErrorState } from "@/components/ds/error-state";
import {
  useAdminMeetingTemplateDetail,
  useUpdateMeetingTemplate,
  type AdminMeetingTemplateCategory,
  type AdminMeetingTemplateItem,
} from "@/hooks/use-meeting-templates";
import type { CreateTemplateInput } from "@/lib/meetings/template-schemas";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

type DraftItem = {
  key: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "";
};

type DraftCategory = {
  key: string;
  name: string;
  items: DraftItem[];
};

interface DraftTemplate {
  name: string;
  overview: string;
  isPrivate: boolean;
  categories: DraftCategory[];
}

let keyCounter = 0;
function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

function toDraftItem(item: AdminMeetingTemplateItem): DraftItem {
  return {
    key: nextKey("item"),
    title: item.title,
    description: item.description ?? "",
    priority: item.priority ?? "",
  };
}

function toDraftCategory(category: AdminMeetingTemplateCategory): DraftCategory {
  return {
    key: nextKey("category"),
    name: category.name,
    items: category.items.map(toDraftItem),
  };
}

function toDraftTemplate(detail: {
  name: string;
  overview: string | null;
  is_private: boolean;
  categories: AdminMeetingTemplateCategory[];
}): DraftTemplate {
  return {
    name: detail.name,
    overview: detail.overview ?? "",
    isPrivate: detail.is_private,
    categories: detail.categories.map(toDraftCategory),
  };
}

function toUpdatePayload(draft: DraftTemplate): CreateTemplateInput {
  return {
    name: draft.name.trim(),
    overview: draft.overview.trim() || undefined,
    is_private: draft.isPrivate,
    categories: draft.categories.map((category) => ({
      name: category.name.trim(),
      items: category.items
        .filter((item) => item.title.trim().length > 0)
        .map((item) => ({
          title: item.title.trim(),
          description: item.description.trim() || undefined,
          priority: item.priority || undefined,
        })),
    })),
  };
}

interface MeetingTemplateEditorClientProps {
  templateId: string;
}

export function MeetingTemplateEditorClient({ templateId }: MeetingTemplateEditorClientProps) {
  const router = useRouter();
  const { data, isLoading, error } = useAdminMeetingTemplateDetail(templateId);
  const updateTemplate = useUpdateMeetingTemplate();

  const [draft, setDraft] = useState<DraftTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft(toDraftTemplate(data));
    }
  }, [data]);

  const handleEdit = useCallback(() => setIsEditing(true), []);

  const handleCancel = useCallback(() => {
    if (data) {
      setDraft(toDraftTemplate(data));
    }
    setIsEditing(false);
  }, [data]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    await updateTemplate.mutateAsync({ templateId, data: toUpdatePayload(draft) });
    setIsEditing(false);
  }, [draft, templateId, updateTemplate]);

  const updateTemplateField = useCallback(
    <K extends keyof DraftTemplate>(field: K, value: DraftTemplate[K]) => {
      setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const addCategory = useCallback(() => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            categories: [
              ...prev.categories,
              { key: nextKey("category"), name: "New category", items: [] },
            ],
          }
        : prev,
    );
  }, []);

  const renameCategory = useCallback((categoryKey: string, name: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((category) =>
              category.key === categoryKey ? { ...category, name } : category,
            ),
          }
        : prev,
    );
  }, []);

  const deleteCategory = useCallback((categoryKey: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.filter((category) => category.key !== categoryKey),
          }
        : prev,
    );
  }, []);

  const addItem = useCallback((categoryKey: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((category) =>
              category.key === categoryKey
                ? {
                    ...category,
                    items: [
                      ...category.items,
                      { key: nextKey("item"), title: "", description: "", priority: "" },
                    ],
                  }
                : category,
            ),
          }
        : prev,
    );
  }, []);

  const updateItem = useCallback(
    (categoryKey: string, itemKey: string, patch: Partial<DraftItem>) => {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((category) =>
                category.key === categoryKey
                  ? {
                      ...category,
                      items: category.items.map((item) =>
                        item.key === itemKey ? { ...item, ...patch } : item,
                      ),
                    }
                  : category,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const deleteItem = useCallback((categoryKey: string, itemKey: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((category) =>
              category.key === categoryKey
                ? { ...category, items: category.items.filter((item) => item.key !== itemKey) }
                : category,
            ),
          }
        : prev,
    );
  }, []);

  if (error) {
    return (
      <PageShell variant="form" title="Meeting Template" onBack={() => router.push("/meeting-templates")}>
        <ErrorState
          title="Failed to load template"
          description={error instanceof Error ? error.message : "An unexpected error occurred."}
        />
      </PageShell>
    );
  }

  if (isLoading || !draft) {
    return (
      <PageShell variant="form" title="Meeting Template" onBack={() => router.push("/meeting-templates")}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="h-24 rounded bg-muted" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title={draft.name || "Meeting Template"}
      onBack={() => router.push("/meeting-templates")}
      actions={
        <EditModeActions
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={updateTemplate.isPending}
        />
      }
    >
      <ContentSectionStack>
        <section className="space-y-4">
          <SectionRuleHeading label="Template details" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              {isEditing ? (
                <Input
                  id="template-name"
                  value={draft.name}
                  onChange={(event) => updateTemplateField("name", event.target.value)}
                />
              ) : (
                <p className="text-sm text-foreground">{draft.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-overview">Overview</Label>
              {isEditing ? (
                <Textarea
                  id="template-overview"
                  value={draft.overview}
                  onChange={(event) => updateTemplateField("overview", event.target.value)}
                  rows={3}
                />
              ) : draft.overview ? (
                <p className="text-sm text-foreground">{draft.overview}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="template-private">Private</Label>
              <Switch
                id="template-private"
                checked={draft.isPrivate}
                disabled={!isEditing}
                onCheckedChange={(checked) => updateTemplateField("isPrivate", checked)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionRuleHeading
            label="Agenda categories"
            actions={isEditing ? <SectionAction onClick={addCategory}>Add category</SectionAction> : undefined}
          />

          {draft.categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Add categories to group agenda items when this template is used."
              action={
                isEditing ? (
                  <Button size="sm" onClick={addCategory}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add category
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-8">
              {draft.categories.map((category) => (
                <div key={category.key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    {isEditing ? (
                      <Input
                        value={category.name}
                        onChange={(event) => renameCategory(category.key, event.target.value)}
                        className="h-8 max-w-sm font-medium"
                      />
                    ) : (
                      <span className="font-medium text-foreground">{category.name}</span>
                    )}
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCategory(category.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 pl-6">
                    {category.items.map((item) => (
                      <div key={item.key} className="space-y-2 rounded-md bg-muted/40 p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            {isEditing ? (
                              <Input
                                value={item.title}
                                onChange={(event) =>
                                  updateItem(category.key, item.key, { title: event.target.value })
                                }
                                placeholder="Item title"
                                className="h-8"
                              />
                            ) : (
                              <p className="text-sm font-medium text-foreground">{item.title}</p>
                            )}
                            {isEditing ? (
                              <Textarea
                                value={item.description}
                                onChange={(event) =>
                                  updateItem(category.key, item.key, {
                                    description: event.target.value,
                                  })
                                }
                                placeholder="Description (optional)"
                                rows={2}
                                className="text-sm"
                              />
                            ) : item.description ? (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            ) : null}
                            {isEditing ? (
                              <Select
                                value={item.priority || undefined}
                                onValueChange={(value) =>
                                  updateItem(category.key, item.key, {
                                    priority: value as DraftItem["priority"],
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 w-32 text-xs">
                                  <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : item.priority ? (
                              <span className="text-xs text-muted-foreground capitalize">
                                {item.priority} priority
                              </span>
                            ) : null}
                          </div>
                          {isEditing && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteItem(category.key, item.key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-muted-foreground"
                        onClick={() => addItem(category.key)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add item
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </ContentSectionStack>
    </PageShell>
  );
}
