"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
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
import {
  INBOX_RULE_ACTIONS,
  INBOX_RULE_ACTION_LABELS,
  INBOX_RULE_FIELDS,
  INBOX_RULE_FIELD_LABELS,
  INBOX_RULE_OPERATORS,
  INBOX_RULE_OPERATOR_LABELS,
  INBOX_RULE_PRIORITIES,
  describeInboxRule,
  type InboxRuleAction,
  type InboxRuleField,
  type InboxRuleOperator,
} from "@/lib/email-assistant/inbox-rules";
import {
  useCreateInboxRule,
  useUpdateInboxRule,
  type InboxRuleDto,
} from "@/hooks/use-inbox-rules";

const CATEGORY_OPTIONS = [
  "Meeting Notes",
  "Accounting",
  "Client Follow-up",
  "Sales Lead",
  "Vendor / Subcontractor",
  "Internal Coordination",
  "Scheduling",
  "No Action",
];

export interface InboxRuleDialogPrefill {
  field?: InboxRuleField;
  operator?: InboxRuleOperator;
  value?: string;
  action?: InboxRuleAction;
}

interface InboxRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this rule; otherwise it creates a new one. */
  rule?: InboxRuleDto | null;
  /** Initial values for a brand-new rule (e.g. seeded from the current email). */
  prefill?: InboxRuleDialogPrefill;
  onSaved?: () => void;
}

export function InboxRuleDialog({
  open,
  onOpenChange,
  rule,
  prefill,
  onSaved,
}: InboxRuleDialogProps) {
  const isEdit = Boolean(rule);
  const createRule = useCreateInboxRule();
  const updateRule = useUpdateInboxRule();
  const isSaving = createRule.isPending || updateRule.isPending;

  const [field, setField] = React.useState<InboxRuleField>("sender");
  const [operator, setOperator] = React.useState<InboxRuleOperator>("contains");
  const [value, setValue] = React.useState("");
  const [action, setAction] = React.useState<InboxRuleAction>("always_important");
  const [actionValue, setActionValue] = React.useState("");

  // Re-seed the form whenever the dialog opens (edit target or prefill).
  React.useEffect(() => {
    if (!open) return;
    if (rule) {
      setField(rule.field);
      setOperator(rule.operator);
      setValue(rule.value);
      setAction(rule.action);
      setActionValue(rule.actionValue ?? "");
    } else {
      setField(prefill?.field ?? "sender");
      setOperator(prefill?.operator ?? "contains");
      setValue(prefill?.value ?? "");
      setAction(prefill?.action ?? "always_important");
      setActionValue("");
    }
  }, [open, rule, prefill]);

  const needsActionValue = action === "set_priority" || action === "set_category";
  const preview =
    value.trim().length > 0
      ? describeInboxRule({
          id: "preview",
          field,
          operator,
          value,
          action,
          actionValue: needsActionValue ? actionValue : null,
          enabled: true,
        })
      : null;

  const canSave =
    value.trim().length > 0 && (!needsActionValue || actionValue.trim().length > 0);

  async function handleSave() {
    if (!canSave || isSaving) return;
    const payload = {
      field,
      operator,
      value: value.trim(),
      action,
      actionValue: needsActionValue ? actionValue.trim() : null,
    };
    try {
      if (rule) {
        await updateRule.mutateAsync({ id: rule.id, ...payload });
        toast.success("Inbox rule updated.");
      } else {
        await createRule.mutateAsync(payload);
        toast.success("Inbox rule created.");
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Could not save the rule. Please try again.");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{isEdit ? "Edit inbox rule" : "Create inbox rule"}</ModalTitle>
          <ModalDescription>
            Teach the assistant how to treat mail matching a sender, subject, or
            body pattern.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Match on</Label>
              <Select
                value={field}
                onValueChange={(next) => setField(next as InboxRuleField)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INBOX_RULE_FIELDS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {INBOX_RULE_FIELD_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition</Label>
              <Select
                value={operator}
                onValueChange={(next) => setOperator(next as InboxRuleOperator)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INBOX_RULE_OPERATORS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {INBOX_RULE_OPERATOR_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. brandon@client.com or “change order”"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Then</Label>
            <Select
              value={action}
              onValueChange={(next) => setAction(next as InboxRuleAction)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INBOX_RULE_ACTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {INBOX_RULE_ACTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action === "set_priority" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={actionValue} onValueChange={setActionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a priority" />
                </SelectTrigger>
                <SelectContent>
                  {INBOX_RULE_PRIORITIES.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {action === "set_category" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={actionValue} onValueChange={setActionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {preview ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-[12px] leading-5 text-muted-foreground">
              {preview}
            </p>
          ) : null}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save rule" : "Create rule"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
