"use client";

import * as React from "react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format as fmtDate } from "date-fns";
import { Plus, ArrowRight, FolderOpen, Pencil, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDrawingSets, useCreateDrawingSet, useUpdateDrawingSet } from "@/hooks/use-drawing-sets";
import { EmptyState } from "@/components/ds";

/** Parse a YYYY-MM-DD string to a local Date (no timezone shift). */
function parseISODate(s: string): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

/** Compact date input with calendar popover for inline table editing. */
function InlineDateInput({
  value,
  onChange,
  onClick,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onClick?: React.MouseEventHandler;
  onKeyDown?: React.KeyboardEventHandler;
}) {
  const dateValue = parseISODate(value);
  return (
    <div className="flex gap-1" onClick={onClick}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        onKeyDown={onKeyDown}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Open calendar"
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              onChange(date ? fmtDate(date, "yyyy-MM-dd") : "");
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

const tabs = (projectId: string) => [
  { label: "Current Drawings", href: `/${projectId}/drawings`, isActive: false },
  { label: "Drawing Sets", href: `/${projectId}/drawings/sets`, isActive: true },
  { label: "Recycle Bin", href: `/${projectId}/drawings/recycle-bin`, isActive: false },
];


export default function DrawingSetsPage() {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const router = useRouter();
  const projectId = params.projectId ?? "";
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [showCreateRow, setShowCreateRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  const { data: sets = [], isLoading } = useDrawingSets(projectId);
  const createSet = useCreateDrawingSet(projectId);
  const updateSet = useUpdateDrawingSet(projectId);

  const filtered = sets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const viewSet = (setId: string) => {
    router.push(`/${projectId}/drawings?view=card&set=${setId}`);
  };

  const startEdit = (set: { id: string; name: string; issued_at: string }) => {
    setEditingId(set.id);
    setEditName(set.name);
    setEditDate(set.issued_at ? set.issued_at.slice(0, 10) : "");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateSet.mutateAsync({
      setId: id,
      data: {
        name: editName.trim(),
        issued_at: editDate ? new Date(editDate).toISOString() : undefined,
      },
    });
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Set name is required");
      return;
    }
    await createSet.mutateAsync({
      name: newName.trim(),
      issued_at: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
    });
    setNewName("");
    setNewDate("");
    setShowCreateRow(false);
  };

  return (
    <PageShell
      variant="table"
      title="Drawing Sets"
      tabs={tabs(projectId)}
      actions={
        <Button size="sm" onClick={() => setShowCreateRow(true)}>
          <Plus />
          New Set
        </Button>
      }
    >
        {/* Search */}
        <div className="mb-4">
          <ExpandableSearch
            placeholder="Search sets..."
            value={search}
            onChange={setSearch}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Published</TableHead>
                <TableHead className="text-center">Unpublished</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Create new set inline row */}
              {showCreateRow && (
                <TableRow>
                  <TableCell>
                    <Input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Set name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                        if (e.key === "Escape") setShowCreateRow(false);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <InlineDateInput
                      value={newDate}
                      onChange={(v) => setNewDate(v)}
                    />
                  </TableCell>
                  <TableCell colSpan={2} />
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleCreate} disabled={createSet.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCreateRow(false)}>
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 && !showCreateRow ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12">
                    <EmptyState
                      icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
                      title="No drawing sets"
                      description="Create a set to group drawings issued together."
                      action={
                        <Button size="sm" variant="outline" onClick={() => setShowCreateRow(true)}>
                          <Plus />
                          New Set
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((set) => (
                  <TableRow
                    key={set.id}
                    className="group/row cursor-pointer hover:bg-muted/40"
                    tabIndex={editingId === set.id ? -1 : 0}
                    onClick={() => {
                      if (editingId !== set.id) viewSet(set.id);
                    }}
                    onKeyDown={(event) => {
                      if (editingId === set.id) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        viewSet(set.id);
                      }
                    }}
                  >
                    <TableCell>
                      {editingId === set.id ? (
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(set.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <span className="font-medium text-primary underline-offset-4 group-hover/row:underline">
                          {set.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === set.id ? (
                        <InlineDateInput
                          value={editDate}
                          onChange={(v) => setEditDate(v)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(set.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        formatDate(set.issued_at)
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {(set as { publishedCount?: number }).publishedCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {(set as { unpublishedCount?: number }).unpublishedCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingId === set.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(set.id)}
                            disabled={updateSet.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(set)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewSet(set.id)}
                          >
                            View Drawings
                            <ArrowRight />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
    </PageShell>
  );
}
