"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";

import { FormSection, ToggleField } from "@/components/forms";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
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
  useChangeEventSettings,
  useUpdateChangeEventSettings,
  type BudgetRomMode,
  type ChangeEventSettings,
} from "@/hooks/use-change-event-settings";
import {
  type PermissionLevel,
  useDirectoryPermissions,
} from "@/hooks/use-directory-permissions";
import { PermissionGate } from "@/components/domain/permissions/PermissionGate";

type ChangeEventsSettingsSection = "change-events-settings" | "permissions";

const BUDGET_ROM_OPTIONS: Array<{ value: BudgetRomMode; label: string }> = [
  { value: "latest_cost", label: "Latest Cost" },
  { value: "latest_price", label: "Latest Price" },
  { value: "none", label: "None" },
];

interface ChangeEventsSettingsTabProps {
  projectId: number;
  section: ChangeEventsSettingsSection;
}

export function ChangeEventsSettingsTab({
  projectId,
  section,
}: ChangeEventsSettingsTabProps) {
  if (section === "permissions") {
    return <ChangeEventsPermissionsPanel projectId={projectId} />;
  }

  return <ChangeEventsSettingsPanel projectId={projectId} />;
}

function ChangeEventsSettingsPanel({ projectId }: { projectId: number }) {
  const { data: settings, isLoading, error } = useChangeEventSettings(projectId);
  const updateMutation = useUpdateChangeEventSettings(projectId);
  const [draft, setDraft] = React.useState<ChangeEventSettings | null>(null);

  React.useEffect(() => {
    if (settings) {
      setDraft(settings);
    }
  }, [settings]);

  const isDirty =
    draft !== null && settings !== undefined
      ? JSON.stringify(draft) !== JSON.stringify(settings)
      : false;

  const updateDraft = <K extends keyof ChangeEventSettings>(
    key: K,
    value: ChangeEventSettings[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft) return;
    await updateMutation.mutateAsync({
      maintain_budget_codes_in_sync: draft.maintain_budget_codes_in_sync,
      display_revenue_rom_columns: draft.display_revenue_rom_columns,
      display_unit_columns: draft.display_unit_columns,
      allow_line_item_autopopulation: draft.allow_line_item_autopopulation,
      always_create_commitment_cos_using_latest_cost:
        draft.always_create_commitment_cos_using_latest_cost,
      copy_attachments_to_prime_pcos: draft.copy_attachments_to_prime_pcos,
      copy_attachments_to_commitment_cos: draft.copy_attachments_to_commitment_cos,
      budget_rom_in_scope: draft.budget_rom_in_scope,
      budget_rom_out_of_scope: draft.budget_rom_out_of_scope,
      budget_rom_tbd_scope: draft.budget_rom_tbd_scope,
      prevent_budget_changes_and_prime_pcos_on_same_line_item:
        draft.prevent_budget_changes_and_prime_pcos_on_same_line_item,
    });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading change event settings...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!draft) {
    return (
      <p className="text-sm text-muted-foreground">
        Change event settings are unavailable for this project.
      </p>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <FormSection
        title="Syncing Objects"
        description="Control how linked change-management records stay aligned as line items move across the workflow."
      >
        <ToggleField
          label="Maintain budget codes across all line items in sync"
          hint="When linked change objects are still editable, budget-code changes stay aligned across change events and downstream change orders."
          checked={draft.maintain_budget_codes_in_sync}
          onCheckedChange={(checked) =>
            updateDraft("maintain_budget_codes_in_sync", checked)
          }
        />
      </FormSection>

      <FormSection
        title="Column Display"
        description="These settings define which financial and unit-based columns are exposed when reviewing change event line items."
      >
        <div className="space-y-4">
          <ToggleField
            label="Display Revenue ROM, Latest Price, Latest Cost, and Over / Under columns"
            hint="Use this when revenue and cost comparison columns should remain visible in the Change Events workflow."
            checked={draft.display_revenue_rom_columns}
            onCheckedChange={(checked) =>
              updateDraft("display_revenue_rom_columns", checked)
            }
          />
          <ToggleField
            label="Display UOM, revenue qty, revenue unit cost, ROM unit qty, and ROM unit cost columns"
            hint="Enable the unit-based line-item columns used on quantity-driven change events."
            checked={draft.display_unit_columns}
            onCheckedChange={(checked) => updateDraft("display_unit_columns", checked)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Line Items"
        description="Decide whether change event line items should auto-fill linked financial context."
      >
        <ToggleField
          label="Allow line item auto-population of budget code, vendor, and contracts"
          hint="Turn this off when your team needs manual control over prefilling behavior on change event line items."
          checked={draft.allow_line_item_autopopulation}
          onCheckedChange={(checked) =>
            updateDraft("allow_line_item_autopopulation", checked)
          }
        />
      </FormSection>

      <FormSection
        title="Change Orders"
        description="Define how downstream commitment and prime change-order creation should behave from change events."
      >
        <div className="space-y-4">
          <ToggleField
            label="Always create commitment change orders using latest cost"
            hint="Leave this off to pass the latest price forward instead."
            checked={draft.always_create_commitment_cos_using_latest_cost}
            onCheckedChange={(checked) =>
              updateDraft(
                "always_create_commitment_cos_using_latest_cost",
                checked,
              )
            }
          />
          <ToggleField
            label="Copy attachments from RFQ responses to prime PCOs"
            hint="Include the latest RFQ response attachments when prime potential change orders are created from change events."
            checked={draft.copy_attachments_to_prime_pcos}
            onCheckedChange={(checked) =>
              updateDraft("copy_attachments_to_prime_pcos", checked)
            }
          />
          <ToggleField
            label="Copy attachments from RFQ responses to commitment COs"
            hint="Include the latest RFQ response attachments when commitment change orders are created from change events."
            checked={draft.copy_attachments_to_commitment_cos}
            onCheckedChange={(checked) =>
              updateDraft("copy_attachments_to_commitment_cos", checked)
            }
          />
        </div>
      </FormSection>

      <FormSection
        title="Budget ROM"
        description="Choose how Budget ROM values are derived for each change-event scope."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <BudgetRomField
            label="Budget ROM for In Scope"
            value={draft.budget_rom_in_scope}
            onChange={(value) => updateDraft("budget_rom_in_scope", value)}
          />
          <BudgetRomField
            label="Budget ROM for Out of Scope"
            value={draft.budget_rom_out_of_scope}
            onChange={(value) => updateDraft("budget_rom_out_of_scope", value)}
          />
          <BudgetRomField
            label="Budget ROM for TBD Scope"
            value={draft.budget_rom_tbd_scope}
            onChange={(value) => updateDraft("budget_rom_tbd_scope", value)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Budget Changes"
        description="Protect line items from carrying conflicting budget and prime change-order impacts."
      >
        <ToggleField
          label="Prevent budget changes and prime change orders on the same change event line item"
          hint="Enable this to stop one line item from carrying both a budget-change path and a prime-contract change-order path at the same time."
          checked={draft.prevent_budget_changes_and_prime_pcos_on_same_line_item}
          onCheckedChange={(checked) =>
            updateDraft(
              "prevent_budget_changes_and_prime_pcos_on_same_line_item",
              checked,
            )
          }
        />
      </FormSection>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          {isDirty ? "Unsaved changes" : "Settings are up to date"}
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => settings && setDraft(settings)}
            disabled={!isDirty || updateMutation.isPending}
          >
            Cancel
          </Button>
          <PermissionGate
            projectId={projectId}
            module="change_events"
            level="admin"
            fallback={
              <Button type="button" disabled>
                Save Changes
              </Button>
            }
          >
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

function BudgetRomField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BudgetRomMode;
  onChange: (value: BudgetRomMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as BudgetRomMode)}>
        <SelectTrigger>
          <SelectValue placeholder="Select behavior" />
        </SelectTrigger>
        <SelectContent>
          {BUDGET_ROM_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangeEventsPermissionsPanel({ projectId }: { projectId: number }) {
  const [search, setSearch] = React.useState("");
  const { users, isLoading, error, searchUsers } = useDirectoryPermissions(
    String(projectId),
  );
  const rows = users.slice(0, 10);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      searchUsers(search);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search, searchUsers]);

  return (
    <FormSection
      title="User Permissions for Change Events"
      description="View project user permissions for Change Events. Company admins and template-managed permissions are controlled in Admin."
    >
      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            aria-label="Search permissions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <InlineTable variant="read">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Name</InlineTableHeaderCell>
            <InlineTableHeaderCell>Company</InlineTableHeaderCell>
            <InlineTableHeaderCell align="center">None</InlineTableHeaderCell>
            <InlineTableHeaderCell align="center">Read Only</InlineTableHeaderCell>
            <InlineTableHeaderCell align="center">Standard</InlineTableHeaderCell>
            <InlineTableHeaderCell align="center">Admin</InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {isLoading ? (
            <InlineTableRow>
              <InlineTableCell colSpan={6}>Loading permissions...</InlineTableCell>
            </InlineTableRow>
          ) : error ? (
            <InlineTableRow>
              <InlineTableCell colSpan={6} className="text-destructive">
                {error.message}
              </InlineTableCell>
            </InlineTableRow>
          ) : rows.length > 0 ? (
            rows.map((user) => (
              <InlineTableRow key={user.id}>
                <InlineTableCell className="font-medium text-primary">
                  {user.full_name || user.email || "Unnamed user"}
                </InlineTableCell>
                <InlineTableCell>{user.company_name ?? "-"}</InlineTableCell>
                <PermissionCell userLevel={user.permission_level} level="none" />
                <PermissionCell userLevel={user.permission_level} level="read_only" />
                <PermissionCell userLevel={user.permission_level} level="standard" />
                <PermissionCell userLevel={user.permission_level} level="admin" />
              </InlineTableRow>
            ))
          ) : (
            <InlineTableRow>
              <InlineTableCell colSpan={6}>
                No project users are available for permission display.
              </InlineTableCell>
            </InlineTableRow>
          )}
        </InlineTableBody>
      </InlineTable>
    </FormSection>
  );
}

function PermissionCell({
  userLevel,
  level,
}: {
  userLevel: PermissionLevel;
  level: PermissionLevel;
}) {
  const isActive = userLevel === level;

  return (
    <InlineTableCell align="center">
      {isActive ? <Check className="mx-auto h-4 w-4 text-primary" /> : null}
    </InlineTableCell>
  );
}
