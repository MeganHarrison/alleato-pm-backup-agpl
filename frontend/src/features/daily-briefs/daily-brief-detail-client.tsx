"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionRuleHeading } from "@/components/layout";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import type { RailData, RailTask } from "@/lib/daily-briefs/morning-brief-tasks";
import { appToast as toast } from "@/lib/toast/app-toast";
import { getErrorDetail } from "@/lib/format-error";
import { apiFetch } from "@/lib/api-client";

type ProjectOption = { id: number; name: string | null; project_number?: string | null };
type UserOption = { id: string; full_name: string | null; email: string | null; person_id: string };

function TaskRow({ task, onRefresh, resolved = false }: { task: RailTask; onRefresh: () => void; resolved?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(task.text);
  const [pending, setPending] = React.useState(false);

  async function mutate(method: "PATCH" | "DELETE", body?: object) {
    setPending(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      onRefresh();
      router.refresh();
    } catch (error) {
      toast.error("Could not update task", { description: getErrorDetail(error) });
    } finally { setPending(false); }
  }

  return (
    <div className="group flex items-start gap-2 border-b border-border/50 py-3 last:border-0">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={resolved ? `Reopen ${task.text}` : `Resolve ${task.text}`} className="mt-0.5 size-5 shrink-0 rounded-full border border-border text-muted-foreground" disabled={pending} onClick={() => void mutate("PATCH", { status: resolved ? "open" : "done" })}>
        {resolved ? <RotateCcw className="size-3" /> : <Check className="size-3" />}
      </Button>
      <div className="min-w-0 flex-1">
        {editing ? <div className="flex gap-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1" autoFocus /><Button size="sm" disabled={pending || !title.trim()} onClick={() => { if (title.trim()) { void mutate("PATCH", { title: title.trim() }); setEditing(false); } }}>Save</Button><Button size="icon-sm" variant="ghost" onClick={() => { setTitle(task.text); setEditing(false); }} aria-label="Cancel edit"><X className="size-4" /></Button></div> : <div className={resolved ? "text-sm text-muted-foreground line-through" : "text-sm font-medium text-foreground"}>{task.text}</div>}
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">{task.project ? <span>{task.project}</span> : null}{task.dueLabel ? <span className={task.urgent ? "font-medium text-danger" : ""}>{task.dueLabel}</span> : null}{!task.you && task.owner ? <span>{task.owner}</span> : null}</div>
      </div>
      {!resolved && !editing ? <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"><Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${task.text}`}><Pencil className="size-4" /></Button><Button size="icon-sm" variant="ghost" onClick={() => { if (window.confirm("Delete this task? This cannot be undone.")) void mutate("DELETE"); }} aria-label={`Delete ${task.text}`}><Trash2 className="size-4" /></Button></div> : null}
    </div>
  );
}

function TaskSection({ title, tasks, projects, users, onRefresh }: { title: string; tasks: RailTask[]; projects: ProjectOption[]; users: UserOption[]; onRefresh: () => void }) {
  return <section className="space-y-2"><div className="flex items-center justify-between"><SectionRuleHeading label={title} className="mb-0" /><NewTaskDialog projects={projects} users={users} onCreated={onRefresh} trigger={<Button size="icon-sm" variant="ghost" aria-label={`Add task to ${title}`}><Plus className="size-4" /></Button>} /></div>{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} onRefresh={onRefresh} />) : <p className="py-2 text-sm text-muted-foreground">No open tasks.</p>}</section>;
}

export function DailyBriefTaskRail({ initialData, projects, users }: { initialData: RailData; projects: ProjectOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [data, setData] = React.useState(initialData);
  const [refreshing, setRefreshing] = React.useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const payload = await apiFetch<{ data?: Array<Record<string, unknown>> }>("/api/tasks?scope=all", { cache: "no-store" });
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const mapped = rows.map((row): RailTask => ({ id: String(row.id), text: String(row.title || row.description || "Untitled task"), project: typeof row.project_name === "string" ? row.project_name : null, projectId: typeof row.project_id === "number" ? row.project_id : null, href: row.project_id ? `/${row.project_id}/tasks` : "/tasks", you: row.assignee_person_id === initialData.brandonPersonId, owner: String(row.assignee_name || "Unassigned"), showOwner: row.assignee_person_id !== initialData.brandonPersonId, urgent: false, dueNormal: Boolean(row.due_date), dueLabel: typeof row.due_date === "string" ? `Due ${row.due_date}` : "", carried: false, since: "", priority: String(row.priority || "medium"), assigneePersonId: typeof row.assignee_person_id === "string" ? row.assignee_person_id : null, reasoning: String(row.description || ""), status: String(row.status || "open") }));
      setData((previous) => ({ ...previous, your: mapped.filter((task) => task.you && task.status !== "done"), team: mapped.filter((task) => !task.you && task.status !== "done"), resolved: mapped.filter((task) => task.status === "done") }));
      router.refresh();
    } catch (error) { toast.error("Could not refresh tasks", { description: getErrorDetail(error) }); } finally { setRefreshing(false); }
  }

  return <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start" aria-label="Daily Brief tasks"><div className="flex items-center justify-between"><div><SectionRuleHeading label="Follow-through" className="mb-0" /><SectionRuleHeading label="Tasks" className="mb-0 text-lg" /></div><span className="text-xs text-muted-foreground">{refreshing ? "Refreshing" : "Live"}</span></div><TaskSection title="Braden's tasks" tasks={data.your} projects={projects} users={users} onRefresh={refresh} /><TaskSection title="Team's tasks" tasks={data.team} projects={projects} users={users} onRefresh={refresh} /><NewTaskDialog projects={projects} users={users} onCreated={refresh} trigger={<Button className="w-full" size="sm"><Plus className="size-4" />Add task</Button>} /></aside>;
}

export function ResolvedTaskSection({ tasks, onRefresh }: { tasks: RailTask[]; onRefresh: () => void }) {
  return <section className="rounded-lg border border-border bg-muted/30 p-5" aria-label="Resolved tasks"><div className="flex items-center justify-between"><div><SectionRuleHeading label="Closed loop" className="mb-0" /><SectionRuleHeading label="Resolved" className="mb-0 text-lg" /></div><span className="text-sm text-muted-foreground">{tasks.length}</span></div>{tasks.length ? <div className="mt-3">{tasks.map((task) => <TaskRow key={task.id} task={task} onRefresh={onRefresh} resolved />)}</div> : <p className="mt-3 text-sm text-muted-foreground">Resolved work will stay here for reference.</p>}</section>;
}
