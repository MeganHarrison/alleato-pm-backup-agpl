"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { SectionRuleHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

type ReviewCandidate = {
  id: string;
  source_document_id: string;
  candidate_project_id: number | null;
  candidate_project_name: string | null;
  confidence: number | null;
  attribution_method: string | null;
  evidence_terms: string[] | null;
  reasoning: string | null;
  status: string;
  created_at: string | null;
  document: {
    id: string;
    title: string | null;
    source: string | null;
    category: string | null;
    type: string | null;
    project_id: number | null;
    project: string | null;
    date: string | null;
    created_at: string | null;
    summary: string | null;
    overview: string | null;
    content: string | null;
    participants: string | null;
  } | null;
};

type AttributionRule = {
  id: string;
  project_id: number;
  project_name: string;
  rule_type: "title_keyword" | "keyword" | "phrase" | "email" | "domain";
  pattern: string;
  pattern_normalized: string;
  confidence: number;
  priority: number;
  source: string;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

type ProjectOption = {
  id: number;
  name: string;
  project_number: string | null;
  archived: boolean | null;
};

type RuleFormState = {
  projectId: string;
  ruleType: AttributionRule["rule_type"];
  pattern: string;
  confidence: string;
  priority: string;
  notes: string;
};

const defaultRuleForm: RuleFormState = {
  projectId: "",
  ruleType: "title_keyword",
  pattern: "",
  confidence: "0.97",
  priority: "35",
  notes: "",
};

function formatConfidence(value: number | null) {
  if (value == null) return "Unknown";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProjectAttributionReviewClient() {
  const [activeView, setActiveView] = React.useState<"rules" | "candidates">("rules");
  const [candidates, setCandidates] = React.useState<ReviewCandidate[]>([]);
  const [rules, setRules] = React.useState<AttributionRule[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [rulesLoading, setRulesLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = React.useState("");
  const [ruleStatusFilter, setRuleStatusFilter] = React.useState<"active" | "inactive" | "all">(
    "active",
  );
  const [ruleForm, setRuleForm] = React.useState<RuleFormState>(defaultRuleForm);
  const [savingRule, setSavingRule] = React.useState(false);

  const loadCandidates = React.useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<{ candidates?: ReviewCandidate[] }>(
        "/api/admin/project-attribution-candidates?status=pending_review&limit=200",
        { cache: "no-store" },
      );
      setCandidates(json.candidates ?? []);
    } catch (error) {
      toast.error("Failed to load attribution candidates", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const loadRules = React.useCallback(async () => {
    setRulesLoading(true);
    try {
      const json = await apiFetch<{
        rules?: AttributionRule[];
        projects?: ProjectOption[];
      }>("/api/admin/project-attribution-rules", { cache: "no-store" });
      setRules(json.rules ?? []);
      setProjects(json.projects ?? []);
    } catch (error) {
      toast.error("Failed to load attribution rules", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setRulesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const filteredRules = React.useMemo(() => {
    const search = ruleSearch.trim().toLowerCase();
    return rules.filter((rule) => {
      if (ruleStatusFilter !== "all" && rule.status !== ruleStatusFilter) return false;
      if (!search) return true;
      return [
        rule.pattern,
        rule.project_name,
        String(rule.project_id),
        rule.rule_type,
        rule.source,
        rule.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [ruleSearch, ruleStatusFilter, rules]);

  const reviewCandidate = React.useCallback(
    async (candidateId: string, action: "approve" | "reject") => {
      setBusyId(candidateId);
      try {
        await apiFetch("/api/admin/project-attribution-candidates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateId, action }),
        });
        setCandidates((prev) => prev.filter((candidate) => candidate.id !== candidateId));
        toast.success(action === "approve" ? "Project assigned" : "Candidate rejected");
      } catch (error) {
        toast.error("Review action failed", {
          description: error instanceof Error ? error.message : "Unexpected error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const saveRule = React.useCallback(async () => {
    const projectId = Number(ruleForm.projectId);
    const confidence = Number(ruleForm.confidence);
    const priority = Number(ruleForm.priority);

    if (!projectId || !ruleForm.pattern.trim()) {
      toast.error("Project and pattern are required");
      return;
    }

    setSavingRule(true);
    try {
      const json = await apiFetch<{ rule: AttributionRule }>(
        "/api/admin/project-attribution-rules",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId,
            ruleType: ruleForm.ruleType,
            pattern: ruleForm.pattern.trim(),
            confidence,
            priority,
            notes: ruleForm.notes.trim() || null,
          }),
        },
      );
      setRules((prev) => [json.rule, ...prev.filter((rule) => rule.id !== json.rule.id)]);
      setRuleForm(defaultRuleForm);
      toast.success("Attribution rule saved");
    } catch (error) {
      toast.error("Failed to save attribution rule", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setSavingRule(false);
    }
  }, [ruleForm]);

  const toggleRuleStatus = React.useCallback(async (rule: AttributionRule) => {
    const nextStatus = rule.status === "active" ? "inactive" : "active";
    setBusyId(rule.id);
    try {
      const json = await apiFetch<{ rule: AttributionRule }>(
        "/api/admin/project-attribution-rules",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ruleId: rule.id, status: nextStatus }),
        },
      );
      setRules((prev) => prev.map((item) => (item.id === json.rule.id ? json.rule : item)));
      toast.success(nextStatus === "active" ? "Rule activated" : "Rule deactivated");
    } catch (error) {
      toast.error("Failed to update attribution rule", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={activeView === "rules" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("rules")}
        >
          Rule matrix
        </Button>
        <Button
          type="button"
          variant={activeView === "candidates" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("candidates")}
        >
          Pending candidates
          {!loading && candidates.length > 0 ? (
            <Badge variant="secondary" className="ml-2">
              {candidates.length}
            </Badge>
          ) : null}
        </Button>
      </div>

      {activeView === "rules" ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <SectionRuleHeading label="Add attribution rule" className="mb-0 pb-0" />
              <p className="mt-1 text-sm text-muted-foreground">
                New project-name terms default to subject/title matching so signatures and body text do
                not overpower stronger project evidence.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,0.8fr)_minmax(180px,1fr)_96px_96px_auto]">
              <Select
                value={ruleForm.projectId}
                onValueChange={(value) => setRuleForm((prev) => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                      {project.project_number ? ` (${project.project_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={ruleForm.ruleType}
                onValueChange={(value: AttributionRule["rule_type"]) =>
                  setRuleForm((prev) => ({ ...prev, ruleType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title_keyword">Subject term</SelectItem>
                  <SelectItem value="email">Owner email</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="keyword">Content keyword</SelectItem>
                  <SelectItem value="phrase">Content phrase</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={ruleForm.pattern}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, pattern: event.target.value }))
                }
                placeholder="Hillsdale, Morrisville, owner@email.com"
              />
              <Input
                value={ruleForm.confidence}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, confidence: event.target.value }))
                }
                aria-label="Confidence"
              />
              <Input
                value={ruleForm.priority}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, priority: event.target.value }))
                }
                inputMode="numeric"
                aria-label="Priority"
              />
              <Button onClick={() => void saveRule()} disabled={savingRule || rulesLoading}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            <Textarea
              value={ruleForm.notes}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional note explaining why this term belongs to the project"
              className="min-h-20"
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <SectionRuleHeading label="Rule matrix" className="mb-0 pb-0" />
                <p className="mt-1 text-sm text-muted-foreground">
                  {rulesLoading
                    ? "Loading rules"
                    : `${filteredRules.length.toLocaleString()} of ${rules.length.toLocaleString()} rules shown`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={ruleSearch}
                    onChange={(event) => setRuleSearch(event.target.value)}
                    placeholder="Search rules"
                    className="w-64 pl-8"
                  />
                </div>
                <Select
                  value={ruleStatusFilter}
                  onValueChange={(value: "active" | "inactive" | "all") =>
                    setRuleStatusFilter(value)
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadRules()}
                  disabled={rulesLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-32 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        Loading attribution rules
                      </TableCell>
                    </TableRow>
                  ) : filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        No attribution rules match the current filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="align-top">
                          <div className="font-medium text-foreground">{rule.project_name}</div>
                          <div className="text-xs text-muted-foreground">Project ID {rule.project_id}</div>
                        </TableCell>
                        <TableCell className="max-w-sm align-top">
                          <div className="font-medium text-foreground">{rule.pattern}</div>
                          {rule.notes ? (
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {rule.notes}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline">{rule.rule_type}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Priority {rule.priority}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary">{formatConfidence(rule.confidence)}</Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          {rule.source}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-end">
                            <Button
                              variant={rule.status === "active" ? "outline" : "default"}
                              size="sm"
                              disabled={busyId === rule.id}
                              onClick={() => void toggleRuleStatus(rule)}
                            >
                              {rule.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      ) : (
        <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionRuleHeading label="Pending candidates" className="mb-0 pb-0" />
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading candidates"
              : `${candidates.length.toLocaleString()} candidates awaiting review`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadCandidates()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Candidate project</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="w-32 text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Loading attribution candidates
                </TableCell>
              </TableRow>
            ) : candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No pending project attribution candidates
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((candidate) => {
                const doc = candidate.document;
                const disabled = busyId === candidate.id;
                const isExpanded = expandedId === candidate.id;
                const description = doc?.overview ?? doc?.summary ?? doc?.content?.slice(0, 400) ?? null;

                return (
                  <React.Fragment key={candidate.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                    >
                      <TableCell className="max-w-sm align-top">
                        <div className="flex items-start gap-2">
                          {isExpanded ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {doc?.title ?? candidate.source_document_id}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{doc?.source ?? "Unknown source"}</span>
                              <span>{doc?.category ?? doc?.type ?? "Uncategorized"}</span>
                              <span>{formatDate(doc?.date ?? doc?.created_at ?? null)}</span>
                              {doc?.project && <Badge variant="outline">Current: {doc.project}</Badge>}
                              {doc?.participants && (
                                <span>
                                  {(() => {
                                    try {
                                      const p = JSON.parse(doc.participants) as string[];
                                      return Array.isArray(p) ? p.join(", ") : doc.participants;
                                    } catch {
                                      return doc.participants;
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                            {description && (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium text-foreground">
                          {candidate.candidate_project_name ?? "Unknown project"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Project ID {candidate.candidate_project_id ?? "missing"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs align-top">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {(candidate.evidence_terms ?? []).slice(0, 5).map((term) => (
                            <Badge key={term} variant="secondary">
                              {term}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {candidate.reasoning ?? candidate.attribution_method ?? "No reasoning recorded"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline">{formatConfidence(candidate.confidence)}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={disabled}
                            aria-label="Reject candidate"
                            onClick={() => void reviewCandidate(candidate.id, "reject")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            disabled={disabled}
                            aria-label="Approve candidate"
                            onClick={() => void reviewCandidate(candidate.id, "approve")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="px-6 py-4">
                          <div className="space-y-3">
                            {doc?.content && (
                              <div>
                                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Message content
                                </div>
                                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-foreground">
                                  {doc.content}
                                </pre>
                              </div>
                            )}
                            {doc?.overview && (
                              <div>
                                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  AI summary
                                </div>
                                <p className="text-sm text-muted-foreground">{doc.overview}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-3 pt-1">
                              <span className="text-xs text-muted-foreground">
                                Assign to <strong>{candidate.candidate_project_name}</strong>?
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => void reviewCandidate(candidate.id, "reject")}
                              >
                                <X className="mr-1.5 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={disabled}
                                onClick={() => void reviewCandidate(candidate.id, "approve")}
                              >
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Approve — assign to {candidate.candidate_project_name}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

        </>
      )}
    </section>
  );
}
