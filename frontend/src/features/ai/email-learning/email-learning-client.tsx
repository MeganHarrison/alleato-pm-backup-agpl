"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { SectionRuleHeading } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";

type RuleAction = "skip" | "review" | "allow" | "not_project";
type FeedbackSignal = "positive" | "negative" | "ignored";

export interface EmailLearningRule {
  id: string;
  sender_pattern: string | null;
  sender_domain: string | null;
  subject_pattern: string | null;
  body_pattern: string | null;
  action: RuleAction;
  label: string | null;
  description: string | null;
  enabled: boolean;
  match_count: number;
  last_matched_at: string | null;
  source_subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLearningFeedbackEvent {
  id: string;
  signal: FeedbackSignal;
  reason_category: string | null;
  free_text: string | null;
  created_at: string;
  after_snapshot: Record<string, unknown> | null;
}

interface FeedbackSummary {
  positive: number;
  negative: number;
  ignored: number;
}

interface EmailLearningClientProps {
  initialRules: EmailLearningRule[];
  recentFeedback: EmailLearningFeedbackEvent[];
  feedbackSummary30d: FeedbackSummary;
}

interface RuleFormState {
  label: string;
  description: string;
  action: RuleAction;
  senderPattern: string;
  senderDomain: string;
  subjectPattern: string;
  bodyPattern: string;
  enabled: boolean;
}

const DEFAULT_RULE_FORM: RuleFormState = {
  label: "",
  description: "",
  action: "skip",
  senderPattern: "",
  senderDomain: "",
  subjectPattern: "",
  bodyPattern: "",
  enabled: true,
};

const ACTION_LABELS: Record<RuleAction, string> = {
  skip: "Skip before import",
  review: "Flag for review",
  allow: "Always allow",
  not_project: "Force not project",
};

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function trimOuterPercents(value: string | null): string {
  if (!value) return "";
  if (value.startsWith("%") && value.endsWith("%") && value.length > 2) {
    return value.slice(1, -1);
  }
  return value;
}

function containsPattern(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `%${trimmed}%` : null;
}

function buildRuleForm(rule: EmailLearningRule | null): RuleFormState {
  if (!rule) return DEFAULT_RULE_FORM;
  return {
    label: rule.label ?? "",
    description: rule.description ?? "",
    action: rule.action,
    senderPattern: rule.sender_pattern ?? "",
    senderDomain: rule.sender_domain ?? "",
    subjectPattern: trimOuterPercents(rule.subject_pattern),
    bodyPattern: trimOuterPercents(rule.body_pattern),
    enabled: rule.enabled,
  };
}

function ruleCriteriaSummary(rule: EmailLearningRule): string[] {
  const parts: string[] = [];
  if (rule.sender_pattern) parts.push(`Sender ${rule.sender_pattern}`);
  if (rule.sender_domain) parts.push(`Domain @${rule.sender_domain}`);
  if (rule.subject_pattern) {
    parts.push(`Subject contains "${trimOuterPercents(rule.subject_pattern)}"`);
  }
  if (rule.body_pattern) {
    parts.push(`Body contains "${trimOuterPercents(rule.body_pattern)}"`);
  }
  return parts;
}

function feedbackTitle(event: EmailLearningFeedbackEvent): string {
  const snapshot = event.after_snapshot ?? {};
  const subject =
    typeof snapshot.subject === "string" && snapshot.subject.trim()
      ? snapshot.subject.trim()
      : "(no subject)";
  const fromName =
    typeof snapshot.fromName === "string" && snapshot.fromName.trim()
      ? snapshot.fromName.trim()
      : null;
  const fromEmail =
    typeof snapshot.fromEmail === "string" && snapshot.fromEmail.trim()
      ? snapshot.fromEmail.trim()
      : null;
  const sender = fromName || fromEmail || "Unknown sender";
  return `${subject} · ${sender}`;
}

function feedbackSignalLabel(signal: FeedbackSignal): string {
  if (signal === "positive") return "Important";
  if (signal === "negative") return "Not important";
  return "Cleared";
}

function feedbackReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return reason.replaceAll("_", " ");
}

function buildRulePayload(form: RuleFormState) {
  return {
    label: form.label.trim() || null,
    description: form.description.trim() || null,
    action: form.action,
    senderPattern: form.senderPattern.trim().toLowerCase() || null,
    senderDomain: form.senderDomain.trim().toLowerCase() || null,
    subjectPattern: containsPattern(form.subjectPattern),
    bodyPattern: containsPattern(form.bodyPattern),
    enabled: form.enabled,
  };
}

function validateRuleForm(form: RuleFormState): string | null {
  if (
    !form.senderPattern.trim() &&
    !form.senderDomain.trim() &&
    !form.subjectPattern.trim() &&
    !form.bodyPattern.trim()
  ) {
    return "Add at least one match field before saving the rule.";
  }
  return null;
}

function RuleEditorModal({
  open,
  rule,
  form,
  submitting,
  onChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  rule: EmailLearningRule | null;
  form: RuleFormState;
  submitting: boolean;
  onChange: (next: Partial<RuleFormState>) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const title = rule ? "Edit rule" : "Add exclusion rule";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalDescription>
            Fill any match fields that should be required. If you fill more than one,
            all filled fields must match the same email.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-learning-label">Rule label</Label>
              <Input
                id="email-learning-label"
                value={form.label}
                onChange={(event) => onChange({ label: event.target.value })}
                placeholder="Skip Capital One notifications"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-learning-action">When this matches</Label>
              <Select
                value={form.action}
                onValueChange={(value) => onChange({ action: value as RuleAction })}
              >
                <SelectTrigger id="email-learning-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-learning-sender">Sender address</Label>
              <Input
                id="email-learning-sender"
                value={form.senderPattern}
                onChange={(event) =>
                  onChange({ senderPattern: event.target.value })
                }
                placeholder="quarantine@messaging.microsoft.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-learning-domain">Sender domain</Label>
              <Input
                id="email-learning-domain"
                value={form.senderDomain}
                onChange={(event) =>
                  onChange({ senderDomain: event.target.value })
                }
                placeholder="notification.capitalone.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-learning-subject">Subject contains</Label>
              <Input
                id="email-learning-subject"
                value={form.subjectPattern}
                onChange={(event) =>
                  onChange({ subjectPattern: event.target.value })
                }
                placeholder="statement ready"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-learning-body">Body contains</Label>
              <Input
                id="email-learning-body"
                value={form.bodyPattern}
                onChange={(event) =>
                  onChange({ bodyPattern: event.target.value })
                }
                placeholder="review these messages"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-learning-description">Operator note</Label>
            <Textarea
              id="email-learning-description"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Why this exists and when it should still be reviewed."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4 text-sm">
            <Label htmlFor="email-learning-enabled" className="font-medium text-foreground">
              Rule is enabled
            </Label>
            <Switch
              id="email-learning-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) => onChange({ enabled: checked })}
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Saving..." : rule ? "Save rule" : "Create rule"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function EmailLearningClient({
  initialRules,
  recentFeedback,
  feedbackSummary30d,
}: EmailLearningClientProps) {
  const [rules, setRules] = React.useState(initialRules);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<EmailLearningRule | null>(
    null,
  );
  const [form, setForm] = React.useState<RuleFormState>(DEFAULT_RULE_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingRuleId, setDeletingRuleId] = React.useState<string | null>(null);

  function openCreateRule() {
    setEditingRule(null);
    setForm(DEFAULT_RULE_FORM);
    setEditorOpen(true);
  }

  function openEditRule(rule: EmailLearningRule) {
    setEditingRule(rule);
    setForm(buildRuleForm(rule));
    setEditorOpen(true);
  }

  async function handleSubmitRule() {
    const validationError = validateRuleForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildRulePayload(form);
      if (editingRule) {
        const updated = await apiFetch<EmailLearningRule>(
          `/api/email-filter-rules/${editingRule.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        setRules((current) =>
          current.map((rule) => (rule.id === updated.id ? updated : rule)),
        );
        toast.success("Rule updated.");
      } else {
        const created = await apiFetch<EmailLearningRule>("/api/email-filter-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setRules((current) =>
          [...current, created].sort((left, right) =>
            right.updated_at.localeCompare(left.updated_at),
          ),
        );
        toast.success("Rule created.");
      }

      setEditorOpen(false);
      setEditingRule(null);
      setForm(DEFAULT_RULE_FORM);
    } catch (error) {
      handleFormError(error, { entity: "email learning rule", action: "save" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleEnabled(rule: EmailLearningRule) {
    try {
      const updated = await apiFetch<EmailLearningRule>(
        `/api/email-filter-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !rule.enabled }),
        },
      );
      setRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(updated.enabled ? "Rule enabled." : "Rule disabled.");
    } catch (error) {
      handleFormError(error, {
        entity: "email learning rule",
        action: rule.enabled ? "disable" : "enable",
      });
    }
  }

  async function handleDeleteRule(ruleId: string) {
    setDeletingRuleId(ruleId);
    try {
      await apiFetch(`/api/email-filter-rules/${ruleId}`, {
        method: "DELETE",
      });
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      toast.success("Rule deleted.");
    } catch (error) {
      handleFormError(error, { entity: "email learning rule", action: "delete" });
    } finally {
      setDeletingRuleId(null);
    }
  }

  const activeRuleCount = rules.filter((rule) => rule.enabled).length;
  const disabledRuleCount = rules.length - activeRuleCount;

  return (
    <>
      <div className="space-y-10">
        <section className="space-y-3">
          <SectionRuleHeading label="What this page controls" />
          <div className="divide-y divide-border/50">
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Exclusion rules are deterministic
                </p>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Rules on this page stop or redirect matching emails before the AI
                  inbox flow imports them. This is the highest-signal place to act on
                  recurring noise.
                </p>
              </div>
              <Badge variant="outline">Active rules {activeRuleCount}</Badge>
            </div>
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Importance feedback is a preference signal
                </p>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Marking an email important or not important affects the working
                  email view and records feedback. It does not directly retrain the
                  model by itself.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                30d: {feedbackSummary30d.positive} important,{" "}
                {feedbackSummary30d.negative} not important
              </span>
            </div>
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Human review still owns broader learning
                </p>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  When you need to review ambiguous intake, draft quality, or
                  human-gated learning proposals, use the linked surfaces below.
                </p>
              </div>
              <Link
                href="/ai/learning-promotions"
                className="text-sm font-medium text-primary"
              >
                Open learning promotions
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionRuleHeading label="Spend time here" />
          <div className="divide-y divide-border/50">
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Recurring sender or domain you never want imported
                </p>
                <p className="text-sm text-muted-foreground">
                  Add a rule here. This is the fastest way to stop low-value noise
                  before it enters the AI workflow.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={openCreateRule}>
                Add rule
              </Button>
            </div>
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Email belongs in or out of your working inbox
                </p>
                <p className="text-sm text-muted-foreground">
                  Use Important or Not important in the Emails view. That is worth
                  doing when the signal is about daily prioritization, not hard
                  exclusion.
                </p>
              </div>
              <Link href="/emails" className="text-sm font-medium text-primary">
                Open Emails
              </Link>
            </div>
            <div className="flex items-start justify-between gap-6 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Misassigned or ambiguous intake
                </p>
                <p className="text-sm text-muted-foreground">
                  Correct project routing and review the intake classifier in the
                  Outlook intake queue.
                </p>
              </div>
              <Link
                href="/outlook-intake"
                className="text-sm font-medium text-primary"
              >
                Open Outlook Intake
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <SectionRuleHeading label="Exclusion rules" />
            <div className="flex items-center gap-3">
              {disabledRuleCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {disabledRuleCount} disabled
                </span>
              ) : null}
              <Button size="sm" onClick={openCreateRule}>
                Add rule
              </Button>
            </div>
          </div>
          {rules.length === 0 ? (
            <EmptyState
              title="No exclusion rules yet"
              description="Add your first deterministic rule here instead of waiting to encounter the email again."
              action={
                <Button size="sm" onClick={openCreateRule}>
                  Add rule
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/50">
              {rules.map((rule) => {
                const criteria = ruleCriteriaSummary(rule);
                return (
                  <div key={rule.id} className="flex items-start justify-between gap-6 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {rule.label || criteria[0] || "Untitled rule"}
                        </p>
                        <Badge variant="outline">{ACTION_LABELS[rule.action]}</Badge>
                        {!rule.enabled ? <Badge variant="outline">Disabled</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {criteria.join(" · ")}
                      </p>
                      {rule.description ? (
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Matched {rule.match_count} times</span>
                        <span>Last matched {formatDateTime(rule.last_matched_at)}</span>
                        <span>Updated {formatDateTime(rule.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRule(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleToggleEnabled(rule)}
                      >
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingRuleId === rule.id}
                        onClick={() => void handleDeleteRule(rule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionRuleHeading label="Recent feedback signals" />
          {recentFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent email-importance feedback is recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {recentFeedback.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-6 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {feedbackTitle(event)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{feedbackSignalLabel(event.signal)}</span>
                      {feedbackReasonLabel(event.reason_category) ? (
                        <span>{feedbackReasonLabel(event.reason_category)}</span>
                      ) : null}
                      <span>{formatDateTime(event.created_at)}</span>
                    </div>
                    {event.free_text ? (
                      <p className="text-sm text-muted-foreground">{event.free_text}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionRuleHeading label="Related surfaces" />
          <div className="divide-y divide-border/50">
            {[
              {
                href: "/emails",
                label: "Emails",
                hint: "Rate importance and work the live inbox view.",
              },
              {
                href: "/outlook-intake",
                label: "Outlook Intake",
                hint: "Correct intake routing and review ambiguous imports.",
              },
              {
                href: "/my-feedback",
                label: "My Feedback",
                hint: "Review what you already rated or corrected.",
              },
              {
                href: "/ai/learning-promotions",
                label: "AI Learning Promotions",
                hint: "Review human-gated learning candidates before they become durable behavior.",
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-6 py-3 text-sm transition-colors hover:text-primary"
              >
                <span className="font-medium text-foreground">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.hint}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <RuleEditorModal
        open={editorOpen}
        rule={editingRule}
        form={form}
        submitting={submitting}
        onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingRule(null);
            setForm(DEFAULT_RULE_FORM);
          }
        }}
        onSubmit={() => void handleSubmitRule()}
      />
    </>
  );
}
