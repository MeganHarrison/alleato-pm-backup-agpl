"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PageContainer,
  PageTabs,
  ProjectPageHeader,
  FormContainer,
} from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  FileText,
  Upload,
  FileIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  useCompanyContext,
  useUpdateCompanyContext,
  useKnowledgeArticles,
  useCreateKnowledgeArticle,
  useUpdateKnowledgeArticle,
  useDeleteKnowledgeArticle,
  type KnowledgeCategory,
  type KnowledgeArticle,
} from "@/hooks/use-company-knowledge";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWLEDGE_CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: "strategy", label: "Strategy" },
  { value: "policy", label: "Policy" },
  { value: "process", label: "Process" },
  { value: "market_intel", label: "Market Intel" },
  { value: "lessons_learned", label: "Lessons Learned" },
  { value: "best_practice", label: "Best Practice" },
  { value: "org_update", label: "Org Update" },
  { value: "general", label: "General" },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CompanyKnowledgePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "articles" | "documents">(
    "profile",
  );

  return (
    <>
      <ProjectPageHeader
        title="Company Knowledge Base"
        description="Manage company profile and knowledge articles for the AI assistant"
      />
      <PageContainer>
        <div className="space-y-6">
          <PageTabs
            tabs={[
              {
                label: "Company Profile",
                href: "profile",
                isActive: activeTab === "profile",
              },
              {
                label: "Knowledge Articles",
                href: "articles",
                isActive: activeTab === "articles",
              },
              {
                label: "Documents",
                href: "documents",
                isActive: activeTab === "documents",
              },
            ]}
            variant="inline"
            className="mb-0"
            onTabClick={(href) =>
              setActiveTab(href as "profile" | "articles" | "documents")
            }
          />

          {activeTab === "profile" ? <CompanyProfileTab /> : null}
          {activeTab === "articles" ? <KnowledgeArticlesTab /> : null}
          {activeTab === "documents" ? <DocumentsTab /> : null}
        </div>
      </PageContainer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Company Profile Tab
// ---------------------------------------------------------------------------

const companyProfileSchema = z.object({
  mission: z.string(),
  vision: z.string(),
  company_history: z.string(),
  founded_year: z.string(),
  headquarters: z.string(),
  employee_count: z.string(),
  annual_revenue_range: z.string(),
  core_values: z.string(),
  key_differentiators: z.string(),
  target_markets: z.string(),
  service_areas: z.string(),
  certifications: z.string(),
  notes: z.string(),
});

type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

const EMPTY_COMPANY_PROFILE: CompanyProfileValues = {
  mission: "",
  vision: "",
  company_history: "",
  founded_year: "",
  headquarters: "",
  employee_count: "",
  annual_revenue_range: "",
  core_values: "",
  key_differentiators: "",
  target_markets: "",
  service_areas: "",
  certifications: "",
  notes: "",
};

function CompanyProfileTab() {
  const { data: ctx, isLoading } = useCompanyContext();
  const updateCtx = useUpdateCompanyContext();

  const form = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: EMPTY_COMPANY_PROFILE,
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  // Hydrate form from fetched company context (preserves comma-joined arrays).
  const joinArray = (val: unknown) =>
    Array.isArray(val) ? (val as string[]).join(", ") : "";

  useEffect(() => {
    if (!ctx) return;
    reset({
      mission: ctx.mission ?? "",
      vision: ctx.vision ?? "",
      company_history: ctx.company_history ?? "",
      founded_year: ctx.founded_year != null ? String(ctx.founded_year) : "",
      headquarters: ctx.headquarters ?? "",
      employee_count:
        ctx.employee_count != null ? String(ctx.employee_count) : "",
      annual_revenue_range: ctx.annual_revenue_range ?? "",
      core_values: joinArray(ctx.core_values),
      key_differentiators: joinArray(ctx.key_differentiators),
      target_markets: joinArray(ctx.target_markets),
      service_areas: joinArray(ctx.service_areas),
      certifications: joinArray(ctx.certifications),
      notes: ctx.notes ?? "",
    });
  }, [ctx, reset]);

  const onSubmit = (values: CompanyProfileValues) => {
    // Convert comma-separated strings to arrays for JSON fields
    const toArray = (val: string) => {
      if (val.trim() === "") return [];
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    };

    updateCtx.mutate(
      {
        mission: values.mission || null,
        vision: values.vision || null,
        company_history: values.company_history || null,
        core_values: toArray(values.core_values),
        key_differentiators: toArray(values.key_differentiators),
        target_markets: toArray(values.target_markets),
        service_areas: toArray(values.service_areas),
        certifications: toArray(values.certifications),
        annual_revenue_range: values.annual_revenue_range || null,
        employee_count: values.employee_count
          ? Number(values.employee_count)
          : null,
        founded_year: values.founded_year ? Number(values.founded_year) : null,
        headquarters: values.headquarters || null,
        notes: values.notes || null,
      } as Record<string, unknown>,
      {
        onSuccess: () => toast.success("Company profile saved"),
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to save company profile";
          setError("root", { type: "server", message });
          reportNonCriticalFailure({
            area: "company-info",
            operation: "save-company-profile",
            error,
            userVisibleFallback: "Company profile was not saved.",
          });
          toast.error(message);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading company profile...
      </div>
    );
  }

  return (
    <FormContainer maxWidth="lg" withCard={false} padding={false}>
      <Form {...form}>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <FormServerError message={errors.root?.message} />

          <FormSection
            title="Company Profile"
            description="This information helps the AI understand your company's identity and strategy."
          >
            <RHFTextareaField
              control={control}
              name="mission"
              label="Mission Statement"
              rows={3}
              placeholder="Our mission is to..."
            />
            <RHFTextareaField
              control={control}
              name="vision"
              label="Vision"
              rows={3}
              placeholder="Our vision is to become..."
            />
            <RHFTextareaField
              control={control}
              name="company_history"
              label="Company History"
              rows={3}
              placeholder="Founded in... key milestones..."
            />

            <FormGrid columns={2}>
              <RHFTextField
                control={control}
                name="founded_year"
                label="Founded Year"
                placeholder="2015"
              />
              <RHFTextField
                control={control}
                name="headquarters"
                label="Headquarters"
                placeholder="City, State"
              />
              <RHFTextField
                control={control}
                name="employee_count"
                label="Employee Count"
                placeholder="50"
              />
              <RHFTextField
                control={control}
                name="annual_revenue_range"
                label="Annual Revenue Range"
                placeholder="$10M - $25M"
              />
            </FormGrid>
          </FormSection>

          <FormSection
            title="Positioning & Notes"
            description="Comma-separated lists are stored as individual entries."
          >
            <RHFTextField
              control={control}
              name="core_values"
              label="Core Values (comma-separated)"
              placeholder="Integrity, Excellence, Safety, Innovation"
            />
            <RHFTextField
              control={control}
              name="key_differentiators"
              label="Key Differentiators (comma-separated)"
              placeholder="In-house engineering, Data-driven approach, 98% on-time delivery"
            />
            <RHFTextField
              control={control}
              name="target_markets"
              label="Target Markets (comma-separated)"
              placeholder="Commercial, Healthcare, Industrial"
            />
            <RHFTextField
              control={control}
              name="service_areas"
              label="Service Areas (comma-separated)"
              placeholder="General Contracting, Design-Build, Construction Management"
            />
            <RHFTextField
              control={control}
              name="certifications"
              label="Certifications (comma-separated)"
              placeholder="LEED AP, OSHA 30, PMP, DBIA"
            />
            <RHFTextareaField
              control={control}
              name="notes"
              label="Notes"
              rows={3}
              placeholder="Any other context the AI should know about the company..."
            />
          </FormSection>

          <FormActions
            submitLabel="Save"
            cancelLabel="Reset"
            onCancel={() => reset()}
            isSubmitting={updateCtx.isPending}
            stickyOnMobile
          />
        </form>
      </Form>
    </FormContainer>
  );
}

// ---------------------------------------------------------------------------
// Knowledge Articles Tab
// ---------------------------------------------------------------------------

function KnowledgeArticlesTab() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(
    null,
  );

  const { data: articles, isLoading } = useKnowledgeArticles({
    category: categoryFilter,
    search: searchFilter || undefined,
  });

  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const deleteArticle = useDeleteKnowledgeArticle();

  const handleDelete = (id: string) => {
    deleteArticle.mutate(id, {
      onSuccess: () => toast.success("Article archived"),
      onError: () => toast.error("Failed to archive article"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Knowledge Articles
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free-form knowledge the AI can reference when answering questions.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditingArticle(null);
                setDialogOpen(true);
              }}
            >
              <Plus />
              Add Article
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingArticle ? "Edit Article" : "New Knowledge Article"}
              </DialogTitle>
            </DialogHeader>
            <ArticleForm
              article={editingArticle}
              onSubmit={(data) => {
                if (editingArticle) {
                  updateArticle.mutate(
                    { id: editingArticle.id, ...data },
                    {
                      onSuccess: () => {
                        toast.success("Article updated");
                        setDialogOpen(false);
                      },
                      onError: () => toast.error("Failed to update article"),
                    },
                  );
                } else {
                  createArticle.mutate(data, {
                    onSuccess: () => {
                      toast.success("Article created");
                      setDialogOpen(false);
                    },
                    onError: () => toast.error("Failed to create article"),
                  });
                }
              }}
              onCancel={() => setDialogOpen(false)}
              isPending={createArticle.isPending || updateArticle.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            className="pl-8 h-9 text-sm"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading articles...
        </div>
      ) : !articles?.length ? (
        <EmptyState
          title="No knowledge articles yet"
          description="Add your first one to start building your AI's understanding of your company."
        />
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="group flex items-start gap-3 rounded-md bg-muted/40 p-3 hover:bg-muted/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {article.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {article.category.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {article.content}
                </p>
                {article.tags && article.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {article.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[10px] h-4"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditingArticle(article);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleDelete(article.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Form
// ---------------------------------------------------------------------------

const CATEGORY_VALUES = KNOWLEDGE_CATEGORIES.map((c) => c.value) as [
  KnowledgeCategory,
  ...KnowledgeCategory[],
];

const articleFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  category: z.enum(CATEGORY_VALUES),
  content: z.string().trim().min(1, "Content is required"),
  tags: z.string(),
  source: z.string(),
});

type ArticleFormValues = z.infer<typeof articleFormSchema>;

function ArticleForm({
  article,
  onSubmit,
  onCancel,
  isPending,
}: {
  article: KnowledgeArticle | null;
  onSubmit: (data: {
    title: string;
    content: string;
    category: KnowledgeCategory;
    tags?: string[];
    source?: string;
  }) => void;
  onCancel?: () => void;
  isPending: boolean;
}) {
  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: {
      title: article?.title ?? "",
      content: article?.content ?? "",
      category: article?.category ?? "general",
      tags: article?.tags?.join(", ") ?? "",
      source: article?.source ?? "",
    },
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const handleFormSubmit = (values: ArticleFormValues) => {
    onSubmit({
      title: values.title.trim(),
      content: values.content.trim(),
      category: values.category,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      source: values.source.trim() || undefined,
    });
  };

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-8"
      >
        <FormServerError message={errors.root?.message} />

        <FormSection title="Article">
          <RHFTextField
            control={control}
            name="title"
            label="Title *"
            placeholder="e.g., Q4 2025 Strategic Priorities"
          />
          <RHFSelectField
            control={control}
            name="category"
            label="Category"
            options={KNOWLEDGE_CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
          />
          <RHFTextareaField
            control={control}
            name="content"
            label="Content *"
            rows={8}
            placeholder="Enter the knowledge content here. The AI will use this to answer questions about your company."
          />
          <RHFTextField
            control={control}
            name="tags"
            label="Tags (comma-separated, optional)"
            placeholder="hiring, growth, Q4"
          />
          <RHFTextField
            control={control}
            name="source"
            label="Source (optional)"
            placeholder="e.g., Board Meeting 2026-01-15, Strategy Deck"
          />
        </FormSection>

        <FormActions
          submitLabel={article ? "Update" : "Create"}
          onCancel={onCancel}
          isSubmitting={isPending}
        />
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Documents Tab
// ---------------------------------------------------------------------------

type UploadedDocument = {
  id: string;
  title: string;
  file_name: string | null;
  category: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
};

function DocumentsTab() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [uploads, setUploads] = useState<
    {
      id: string;
      file: File;
      status: "uploading" | "success" | "error";
      message?: string;
    }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing documents
  const fetchDocuments = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("document_metadata")
        .select("id, title, file_name, category, source, status, created_at")
        .eq("source", "upload")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setDocuments(data as UploadedDocument[]);
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "company-info",
        operation: "fetch-documents",
        error,
        userVisibleFallback: "Could not load uploaded documents.",
      });
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;

    for (const file of Array.from(selectedFiles)) {
      const uploadId = crypto.randomUUID();
      setUploads((prev) => [
        { id: uploadId, file, status: "uploading" as const },
        ...prev,
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "document");

        await apiFetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? {
                  ...u,
                  status: "success",
                  message: "Uploaded — pipeline processing queued",
                }
              : u,
          ),
        );
        // Refresh documents list
        fetchDocuments();
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Network error";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: "error", message } : u,
          ),
        );
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "uploaded":
        return "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
      case "processing":
        return "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
      case "ready":
        return "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400";
      case "error":
        return "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Document Uploads
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload PDFs, Word docs, or text files. They&apos;ll be parsed,
            embedded, and made available to the AI assistant.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md,.markdown"
            multiple
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-md bg-muted/40 p-3"
            >
              {upload.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {upload.status === "success" && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {upload.status === "error" && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground truncate block">
                  {upload.file.name}
                </span>
                {upload.message && (
                  <span className="text-xs text-muted-foreground">
                    {upload.message}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {(upload.file.size / 1024).toFixed(0)} KB
              </span>
              {upload.status !== "uploading" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeUpload(upload.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Documents list */}
      {isLoadingDocs ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading documents...
        </div>
      ) : !documents.length ? (
        <EmptyState
          icon={<FileIcon />}
          title="No documents uploaded yet"
          description="Upload PDFs, DOCX, or text files to build your AI knowledge base. Supported: .pdf, .docx, .doc, .txt, .md"
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-start gap-3 rounded-md bg-muted/40 p-3 hover:bg-muted/60 transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {doc.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${getStatusColor(doc.status)}`}
                  >
                    {doc.status ?? "unknown"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.file_name && (
                    <span className="text-xs text-muted-foreground truncate">
                      {doc.file_name}
                    </span>
                  )}
                  {doc.created_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
