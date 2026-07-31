"use client";

import * as React from "react";
import {
  ArrowRight,
  Bot,
  FileImage,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { EmptyState, StatusText } from "@/components/ds";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { APP_KNOWLEDGE_TOOL_CATEGORIES } from "@/features/knowledge/app-knowledge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TRAINING_DOC_AUDIENCES,
  TRAINING_DOC_STATUSES,
  type TrainingDocStatus,
  normalizeTrainingDocSlug,
} from "@/lib/training-docs/constants";
import type {
  TrainingDocAsset,
  TrainingDocWithAssets,
} from "@/lib/training-docs/types";
import {
  useDeleteTrainingDoc,
  useDeleteTrainingDocAsset,
  useGenerateTrainingDoc,
  usePublishTrainingDoc,
  useUpdateTrainingDoc,
  useUpdateTrainingDocAsset,
  useUploadTrainingDocAsset,
} from "@/hooks/use-training-docs";

type DocFormState = {
  title: string;
  slug: string;
  summary: string;
  audience: "internal" | "client" | "subcontractor" | "admin";
  status: TrainingDocStatus;
  source_route: string;
  app_tool_category: string;
  review_notes: string;
  target_collection: string;
  body_markdown: string;
};

type AssetDraftState = Record<
  string,
  {
    caption: string;
    alt_text: string;
    step_order: string;
  }
>;

function toFormState(doc: TrainingDocWithAssets): DocFormState {
  return {
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary ?? "",
    audience: doc.audience,
    status: doc.status,
    source_route: doc.source_route ?? "",
    app_tool_category: getMetadataString(doc.metadata, "appToolCategory"),
    review_notes: doc.review_notes ?? "",
    target_collection: doc.target_collection,
    body_markdown: doc.body_markdown,
  };
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function toAssetDrafts(assets: TrainingDocAsset[]): AssetDraftState {
  return Object.fromEntries(
    assets.map((asset) => [
      asset.id,
      {
        caption: asset.caption ?? "",
        alt_text: asset.alt_text ?? "",
        step_order: String(asset.step_order),
      },
    ]),
  );
}

export function TrainingDocEditor({
  doc,
  onDeleted,
}: {
  doc: TrainingDocWithAssets;
  onDeleted?: () => void;
}) {
  const updateDoc = useUpdateTrainingDoc();
  const deleteDoc = useDeleteTrainingDoc();
  const uploadAsset = useUploadTrainingDocAsset();
  const updateAsset = useUpdateTrainingDocAsset();
  const deleteAsset = useDeleteTrainingDocAsset();
  const publishDoc = usePublishTrainingDoc();
  const generateDoc = useGenerateTrainingDoc();

  const [form, setForm] = React.useState<DocFormState>(() => toFormState(doc));
  const [assetDrafts, setAssetDrafts] = React.useState<AssetDraftState>(() =>
    toAssetDrafts(doc.assets),
  );

  React.useEffect(() => {
    setForm(toFormState(doc));
    setAssetDrafts(toAssetDrafts(doc.assets));
  }, [doc.id]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(doc));

  async function handleSave() {
    await updateDoc.mutateAsync({
      id: doc.id,
      ...form,
      slug: normalizeTrainingDocSlug(form.slug, form.title),
      app_tool_category: form.app_tool_category || null,
    });
  }

  async function handleDelete() {
    await deleteDoc.mutateAsync(doc.id);
    onDeleted?.();
  }

  async function handlePublish() {
    if (isDirty) {
      await handleSave();
    }
    await publishDoc.mutateAsync(doc.id);
  }

  async function handleGenerate() {
    if (isDirty) {
      await handleSave();
    }
    await generateDoc.mutateAsync({
      docId: doc.id,
      route: form.source_route,
    });
  }

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAsset.mutateAsync({ docId: doc.id, file });
    event.target.value = "";
  }

  async function handleSaveAsset(assetId: string) {
    const draft = assetDrafts[assetId];
    if (!draft) return;
    await updateAsset.mutateAsync({
      assetId,
      caption: draft.caption.trim() || null,
      alt_text: draft.alt_text.trim() || null,
      step_order: Number.parseInt(draft.step_order || "0", 10) || 0,
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Editor</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <StatusText status={doc.status.replace("_", " ")} />
              <span>
                {doc.assets.length} image{doc.assets.length === 1 ? "" : "s"}
              </span>
              {doc.published_doc_path ? (
                <span className="font-mono text-xs text-foreground">
                  {doc.published_doc_path}
                </span>
              ) : (
                <span>Not published yet</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleteDoc.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!isDirty || updateDoc.isPending}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generateDoc.isPending || !form.source_route.trim()}
            >
              <Bot className="h-4 w-4" />
              Generate with AI
            </Button>
            <Button onClick={handlePublish} disabled={publishDoc.isPending}>
              <ArrowRight className="h-4 w-4" />
              Publish to Docs
            </Button>
          </div>
        </div>

        {doc.last_publish_error ? (
          <InfoAlert variant="error">
            Last publish error: {doc.last_publish_error}
          </InfoAlert>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Document</h3>
        <Field label="Title">
          <Input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
          />
        </Field>
        <Field label="Slug">
          <Input
            value={form.slug}
            onChange={(event) =>
              setForm((current) => ({ ...current, slug: event.target.value }))
            }
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Audience">
            <Select
              value={form.audience}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  audience: value as DocFormState["audience"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_DOC_AUDIENCES.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {audience}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tool category">
            <Select
              value={form.app_tool_category || "none"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  app_tool_category: value === "none" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {APP_KNOWLEDGE_TOOL_CATEGORIES.map((category) => (
                  <SelectItem key={category.slug} value={category.slug}>
                    {category.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  status: value as DocFormState["status"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_DOC_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Source Route">
          <Input
            value={form.source_route}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                source_route: event.target.value,
              }))
            }
            placeholder="/create-project"
          />
        </Field>
        <Field label="Target Collection">
          <Input
            value={form.target_collection}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                target_collection: event.target.value,
              }))
            }
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Generated Steps
            </h3>
            <p className="text-sm text-muted-foreground">
              AI browser capture owns the step order and screenshots.
            </p>
          </div>
        </div>

        {doc.steps.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-5 w-5" />}
            title="No generated steps yet"
            description="Add a source route, then generate the training flow with AI browser capture."
          />
        ) : (
          <div className="divide-y">
            {doc.steps
              .slice()
              .sort((left, right) => left.step_order - right.step_order)
              .map((step, index) => (
                <div
                  key={step.id}
                  className="grid gap-4 py-5 first:pt-0 md:grid-cols-[minmax(0,1fr)_18rem]"
                >
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">
                      Step {index + 1}: {step.title}
                    </div>
                    <div className="whitespace-pre-line text-sm text-foreground">
                      {step.instruction_markdown}
                    </div>
                    {step.expected_result ? (
                      <div className="text-sm text-muted-foreground">
                        Expected result: {step.expected_result}
                      </div>
                    ) : null}
                    {step.source_url ? (
                      <div className="font-mono text-xs text-muted-foreground">
                        {step.source_url}
                      </div>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-md border bg-muted/20">
                    {step.screenshot_asset?.signed_url ? (
                      <img
                        src={step.screenshot_asset.signed_url}
                        alt={
                          step.screenshot_asset.alt_text ??
                          step.screenshot_asset.file_name
                        }
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
                        Screenshot unavailable
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Content</h3>
        <Field label="Summary">
          <Textarea
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                summary: event.target.value,
              }))
            }
            className="min-h-20"
          />
        </Field>
        <Field label="Review Notes">
          <Textarea
            value={form.review_notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                review_notes: event.target.value,
              }))
            }
            className="min-h-20"
          />
        </Field>
        <Field label="Article Markdown">
          <Textarea
            value={form.body_markdown}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                body_markdown: event.target.value,
              }))
            }
            rows={24}
            className="font-mono text-sm"
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">
            Screenshots
          </h3>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50">
              <Upload className="h-4 w-4" />
              Upload image
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadFile}
            />
          </label>
        </div>

        {doc.assets.length === 0 ? (
          <EmptyState
            icon={<FileImage className="h-5 w-5" />}
            title="No screenshots yet"
            description="AI generation captures screenshots automatically. Manual upload is only a review fallback."
          />
        ) : (
          <div className="space-y-6">
            {doc.assets
              .slice()
              .sort((left, right) => left.step_order - right.step_order)
              .map((asset) => {
                const draft = assetDrafts[asset.id] ?? {
                  caption: asset.caption ?? "",
                  alt_text: asset.alt_text ?? "",
                  step_order: String(asset.step_order),
                };

                return (
                  <div
                    key={asset.id}
                    className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="max-w-sm overflow-hidden rounded-md border bg-muted/20">
                      {asset.signed_url ? (
                        <img
                          src={asset.signed_url}
                          alt={asset.alt_text ?? asset.file_name}
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                          Preview unavailable
                        </div>
                      )}
                    </div>

                    <div className="max-w-3xl space-y-3">
                      <div className="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)]">
                        <Field label="Order">
                          <Input
                            value={draft.step_order}
                            onChange={(event) =>
                              setAssetDrafts((current) => ({
                                ...current,
                                [asset.id]: {
                                  ...draft,
                                  step_order: event.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Caption">
                          <Input
                            value={draft.caption}
                            onChange={(event) =>
                              setAssetDrafts((current) => ({
                                ...current,
                                [asset.id]: {
                                  ...draft,
                                  caption: event.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                      </div>

                      <Field label="Alt Text">
                        <Input
                          value={draft.alt_text}
                          onChange={(event) =>
                            setAssetDrafts((current) => ({
                              ...current,
                              [asset.id]: {
                                ...draft,
                                alt_text: event.target.value,
                              },
                            }))
                          }
                        />
                      </Field>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveAsset(asset.id)}
                          disabled={updateAsset.isPending}
                        >
                          Save screenshot details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAsset.mutate(asset.id)}
                          disabled={deleteAsset.isPending}
                        >
                          Delete screenshot
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {children}
    </label>
  );
}
