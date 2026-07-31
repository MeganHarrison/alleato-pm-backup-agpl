"use client";

import * as React from "react";
import { Check, MoreVertical, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignMemberDialog } from "@/components/domain/directory/AssignMemberDialog";
import {
  ROLE_CATALOG,
  ROLE_CATEGORY_ORDER,
  type CatalogRole,
  type RoleCategory,
} from "@/lib/constants/role-catalog";
import { useConfirm } from "@/hooks/use-confirm";
import type { ProjectRole } from "@/hooks/use-project-roles";

function reportProjectTeamDialogError(
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
): string {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    JSON.stringify({
      event,
      error: message,
      ...context,
    }),
  );
  return message;
}

function personInitials(first: string | null, last: string | null): string {
  const f = (first ?? "").charAt(0);
  const l = (last ?? "").charAt(0);
  return `${f}${l}`.toUpperCase() || "?";
}

function personDisplayName(
  first: string | null,
  last: string | null,
  fallback: string | null,
): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback || "Unknown";
}

export function ProjectTeamDialog({
  open,
  onOpenChange,
  roles,
  createRole,
  updateRoleMembers,
  deleteRole,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: ProjectRole[];
  createRole: (name: string) => Promise<ProjectRole>;
  updateRoleMembers: (roleId: string, personIds: string[]) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
  projectId: string;
}) {
  const [assignRole, setAssignRole] = React.useState<ProjectRole | null>(null);
  const [addRoleOpen, setAddRoleOpen] = React.useState(false);
  const [customRoleMode, setCustomRoleMode] = React.useState(false);
  const [customRoleName, setCustomRoleName] = React.useState("");
  const [savingRoleId, setSavingRoleId] = React.useState<string | null>(null);
  const [memberIdsByRoleId, setMemberIdsByRoleId] = React.useState<
    Record<string, string[]>
  >({});
  const { confirm, ConfirmDialog } = useConfirm();

  React.useEffect(() => {
    if (!open) return;
    setAddRoleOpen(false);
    setCustomRoleMode(false);
    setCustomRoleName("");
    setMemberIdsByRoleId(
      Object.fromEntries(
        roles.map((role) => [
          role.id,
          role.members.map((member) => member.person_id),
        ]),
      ),
    );
  }, [open, roles]);

  // Keep the selected assign-role in sync with refetched role data so the
  // assignment modal always reflects the latest members after a save.
  React.useEffect(() => {
    setAssignRole((current) =>
      current ? roles.find((r) => r.id === current.id) ?? null : current,
    );
  }, [roles]);

  const existingRoleNames = React.useMemo(
    () => new Set(roles.map((r) => r.role_name.toLowerCase())),
    [roles],
  );

  const sortedRoles = React.useMemo(() => {
    return [...roles].sort((a, b) => {
      const aIdx = ROLE_CATALOG.findIndex((r) => r.name === a.role_name);
      const bIdx = ROLE_CATALOG.findIndex((r) => r.name === b.role_name);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.role_name.localeCompare(b.role_name);
    });
  }, [roles]);

  const catalogByCategory = React.useMemo(() => {
    const groups = new Map<RoleCategory, CatalogRole[]>();
    for (const role of ROLE_CATALOG) {
      const list = groups.get(role.category) ?? [];
      list.push(role);
      groups.set(role.category, list);
    }
    return groups;
  }, []);

  const handleAddCatalogRole = async (name: string) => {
    setAddRoleOpen(false);
    try {
      await createRole(name);
      toast.success(`Added ${name}`);
    } catch (error) {
      const message = reportProjectTeamDialogError(
        "project_team_catalog_role_create_failed",
        error,
        { roleName: name },
      );
      toast.error(`Role was not added: ${message}`);
    }
  };

  const handleAddCustomRole = async () => {
    const name = customRoleName.trim();
    if (!name) return;
    if (existingRoleNames.has(name.toLowerCase())) {
      toast.error("That role already exists");
      return;
    }
    setAddRoleOpen(false);
    setCustomRoleMode(false);
    setCustomRoleName("");
    try {
      await createRole(name);
      toast.success(`Added ${name}`);
    } catch (error) {
      const message = reportProjectTeamDialogError(
        "project_team_custom_role_create_failed",
        error,
        { roleName: name },
      );
      toast.error(`Role was not added: ${message}`);
    }
  };

  const getCurrentMemberIds = React.useCallback(
    (role: ProjectRole) =>
      memberIdsByRoleId[role.id] ??
      role.members.map((member) => member.person_id),
    [memberIdsByRoleId],
  );

  const handleRemovePerson = async (role: ProjectRole, personId: string) => {
    const previous = getCurrentMemberIds(role);
    const next = previous.filter((id) => id !== personId);
    setMemberIdsByRoleId((current) => ({ ...current, [role.id]: next }));
    setSavingRoleId(role.id);
    try {
      await updateRoleMembers(role.id, next);
    } catch (error) {
      setMemberIdsByRoleId((current) => ({ ...current, [role.id]: previous }));
      const message = reportProjectTeamDialogError(
        "project_team_role_member_remove_failed",
        error,
        { roleId: role.id, personId },
      );
      toast.error(`Role assignment was not updated: ${message}`);
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDeleteRole = async (role: ProjectRole) => {
    const ok = await confirm({
      description: `Delete role "${role.role_name}"? This will remove all assignments for this role.`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteRole(role.id);
      toast.success("Role removed");
    } catch (error) {
      const message = reportProjectTeamDialogError(
        "project_team_role_delete_failed",
        error,
        { roleId: role.id, roleName: role.role_name },
      );
      toast.error(`Role was not removed: ${message}`);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent size="2xl" className="gap-0 max-h-dvh overflow-y-auto p-0">
          <ModalHeader className="px-6 pt-6 pb-3 space-y-1">
            <ModalTitle className="text-lg tracking-tight">
              Project Team
            </ModalTitle>
            <ModalDescription className="text-xs">
              Add roles and assign people. Changes save automatically.
            </ModalDescription>
          </ModalHeader>

          <div className="px-2 pb-2">
            {sortedRoles.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No roles yet. Click{" "}
                <span className="font-medium text-foreground">Add role</span>{" "}
                below to start.
              </p>
            ) : (
              <ul className="space-y-px">
                {sortedRoles.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    currentMemberIds={getCurrentMemberIds(role)}
                    saving={savingRoleId === role.id}
                    onAssign={() => setAssignRole(role)}
                    onRemovePerson={(personId) =>
                      handleRemovePerson(role, personId)
                    }
                    onDeleteRole={() => handleDeleteRole(role)}
                  />
                ))}
              </ul>
            )}
          </div>

          {addRoleOpen && (
            <div className="border-t border-border/40 px-4 py-3 space-y-2">
              {customRoleMode ? (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder="e.g. Drone Surveyor"
                    value={customRoleName}
                    onChange={(e) => setCustomRoleName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddCustomRole();
                      if (e.key === "Escape") {
                        setCustomRoleMode(false);
                        setCustomRoleName("");
                      }
                    }}
                    className="h-9"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomRoleMode(false);
                        setCustomRoleName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!customRoleName.trim()}
                      onClick={() => void handleAddCustomRole()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <Command className="overflow-visible bg-transparent">
                  <CommandInput placeholder="Search roles…" className="h-9" />
                  <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
                    <CommandEmpty>No matching roles.</CommandEmpty>
                    {ROLE_CATEGORY_ORDER.map((category) => {
                      const items = catalogByCategory.get(category) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <CommandGroup key={category} heading={category}>
                          {items.map((role) => {
                            const alreadyAdded = existingRoleNames.has(
                              role.name.toLowerCase(),
                            );
                            return (
                              <CommandItem
                                key={role.name}
                                value={role.name}
                                disabled={alreadyAdded}
                                onSelect={() => {
                                  if (!alreadyAdded) {
                                    void handleAddCatalogRole(role.name);
                                  }
                                }}
                              >
                                <span className="flex-1">{role.name}</span>
                                {alreadyAdded && (
                                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      );
                    })}
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => setCustomRoleMode(true)}
                        value="__add_custom__"
                      >
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Add custom role…
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </div>
          )}

          <ModalFooter className="px-6 py-4 border-t border-border/40 flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (addRoleOpen) {
                  setAddRoleOpen(false);
                  setCustomRoleMode(false);
                  setCustomRoleName("");
                } else {
                  setAddRoleOpen(true);
                }
              }}
            >
              {addRoleOpen ? (
                <>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add role
                </>
              )}
            </Button>

            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reuse the exact same assignment modal the directory table rows use. */}
      <AssignMemberDialog
        open={assignRole !== null}
        onOpenChange={(next) => {
          if (!next) setAssignRole(null);
        }}
        role={assignRole}
        onSave={updateRoleMembers}
        projectId={projectId}
      />

      {ConfirmDialog}
    </>
  );
}

function RoleRow({
  role,
  currentMemberIds,
  saving,
  onAssign,
  onRemovePerson,
  onDeleteRole,
}: {
  role: ProjectRole;
  currentMemberIds: string[];
  saving: boolean;
  onAssign: () => void;
  onRemovePerson: (personId: string) => void;
  onDeleteRole: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/40">
      <span className="w-44 shrink-0 truncate text-sm text-muted-foreground">
        {role.role_name}
      </span>
      <div className="flex flex-1 flex-wrap items-start gap-1.5 min-w-0">
        {currentMemberIds.map((personId) => {
          const member = role.members.find((m) => m.person_id === personId);
          const p = member?.person ?? null;
          const display = personDisplayName(
            p?.first_name ?? null,
            p?.last_name ?? null,
            p?.email ?? null,
          );
          return (
            <Badge
              key={personId}
              variant="outline"
              className="gap-1.5 py-0.5 pl-1 pr-1 text-xs bg-muted/40"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                  {personInitials(p?.first_name ?? null, p?.last_name ?? null)}
                </AvatarFallback>
              </Avatar>
              <span className="w-36 truncate font-medium">{display}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemovePerson(personId)}
                className="h-4 w-4 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${display}`}
                disabled={saving}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary"
          disabled={saving}
          onClick={onAssign}
        >
          {currentMemberIds.length === 0 ? "Assign" : "+ Add"}
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={saving}
            aria-label={`Actions for ${role.role_name}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive" onClick={onDeleteRole}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Remove role
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
