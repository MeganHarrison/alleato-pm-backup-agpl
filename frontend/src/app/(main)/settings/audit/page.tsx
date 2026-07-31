"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { UserPlus, Settings, Link, Shield, Trash2 } from "lucide-react";
import { PageShell } from "@/components/layout";
import { EmptyState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditAction =
  | "member_invited"
  | "member_removed"
  | "role_changed"
  | "integration_connected"
  | "integration_disconnected"
  | "settings_changed"
  | "project_created";

interface AuditEvent {
  id: string;
  actor: string;
  actorInitials: string;
  action: AuditAction;
  target: string;
  detail?: string;
  timestamp: string;
  date: string;
}

const AUDIT_EVENTS: AuditEvent[] = [];

// ---------------------------------------------------------------------------
// Action metadata
// ---------------------------------------------------------------------------

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: React.ElementType; color: string }
> = {
  member_invited: { label: "Invited member", icon: UserPlus, color: "text-primary bg-primary/10" },
  member_removed: { label: "Removed member", icon: Trash2, color: "text-destructive bg-destructive/10" },
  role_changed: { label: "Changed role", icon: Shield, color: "text-primary bg-primary/10" },
  integration_connected: { label: "Connected integration", icon: Link, color: "text-success bg-success/10" },
  integration_disconnected: { label: "Disconnected integration", icon: Link, color: "text-warning bg-warning/10" },
  settings_changed: { label: "Changed settings", icon: Settings, color: "text-muted-foreground bg-muted" },
  project_created: { label: "Created project", icon: Settings, color: "text-primary bg-primary/10" },
};

// ---------------------------------------------------------------------------
// Group events by date
// ---------------------------------------------------------------------------

function groupByDate(events: AuditEvent[]) {
  const groups: { date: string; events: AuditEvent[] }[] = [];
  const seen = new Map<string, number>();

  for (const event of events) {
    if (seen.has(event.date)) {
      groups[seen.get(event.date)!].events.push(event);
    } else {
      seen.set(event.date, groups.length);
      groups.push({ date: event.date, events: [event] });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Audit row
// ---------------------------------------------------------------------------

function AuditRow({ event }: { event: AuditEvent }) {
  const meta = ACTION_META[event.action];
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      {/* Action icon */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          meta.color
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{event.actor}</span>
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <span className="text-sm font-medium">{event.target}</span>
          {event.detail && (
            <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              {event.detail}
            </span>
          )}
        </div>
      </div>

      {/* Actor avatar + time */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">{event.timestamp}</span>
        <Avatar className="h-5 w-5">
          <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
            {event.actorInitials}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    let result = AUDIT_EVENTS;
    if (actionFilter !== "all") {
      result = result.filter((e) => e.action === actionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.actor.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, actionFilter]);

  const grouped = groupByDate(filtered);

  return (
    <PageShell variant="dashboard" title="Audit Log">
    <div className="px-8 py-8 max-w-4xl">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <ExpandableSearch
          value={search}
          onChange={setSearch}
          placeholder="Search events..."
        />

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="member_invited">Member invited</SelectItem>
            <SelectItem value="member_removed">Member removed</SelectItem>
            <SelectItem value="role_changed">Role changed</SelectItem>
            <SelectItem value="integration_connected">Integration connected</SelectItem>
            <SelectItem value="settings_changed">Settings changed</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="30d">
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event groups */}
      {grouped.length === 0 ? (
        <EmptyState
          title="No events found"
          description="Audit events will appear here as actions are taken in the system."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.date}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                {group.date}
              </p>
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {group.events.map((event) => (
                  <AuditRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </PageShell>
  );
}
