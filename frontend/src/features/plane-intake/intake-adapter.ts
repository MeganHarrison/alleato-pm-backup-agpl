/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project intake status and list templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import type { TasksRow } from "@/features/tasks/task-utils";

export type IntakeTab = "open" | "closed";
export type IntakeSource = "task" | "outlook";

export interface OutlookIntakeEmail {
  id: number;
  subject: string;
  body: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toList: string[];
  matchStatus: string;
  assignmentMethod: string | null;
  assignmentConfidence: number | null;
  receivedAt: string | null;
  hasAttachments: boolean | null;
  webLink: string | null;
  createdAt: string | null;
  project: {
    id: number;
    name: string | null;
    projectNumber: string | null;
  } | null;
}

interface IntakeItemBase {
  key: string;
  source: IntakeSource;
  title: string;
  summary: string | null;
  status: string;
  tab: IntakeTab;
  occurredAt: string | null;
}

export interface TaskIntakeItem extends IntakeItemBase {
  source: "task";
  task: TasksRow;
}

export interface EmailIntakeItem extends IntakeItemBase {
  source: "outlook";
  email: OutlookIntakeEmail;
}

export type IntakeItem = TaskIntakeItem | EmailIntakeItem;

const CLOSED_TASK_STATUSES = new Set(["done", "complete", "closed", "cancelled"]);

export function formatIntakeIdentifier(
  item: IntakeItem,
  projectIdentifier: string,
): string {
  if (item.source === "task") {
    return `${projectIdentifier}-${item.task.id?.slice(0, 6) ?? "TASK"}`;
  }

  return `OUTLOOK-${String(item.email.id).slice(0, 6)}`;
}

export function normalizeTaskIntake(tasks: TasksRow[]): TaskIntakeItem[] {
  return tasks
    .filter((task): task is TasksRow & { id: string } => Boolean(task.id))
    .map((task) => {
      const normalizedStatus = (task.status ?? "open").toLowerCase();
      return {
        key: `task:${task.id}`,
        source: "task",
        title: task.title?.trim() || task.description?.trim() || "Untitled task",
        summary: task.title?.trim() ? task.description?.trim() || null : null,
        status: normalizedStatus,
        tab: CLOSED_TASK_STATUSES.has(normalizedStatus) ? "closed" : "open",
        occurredAt: task.created_at,
        task,
      };
    });
}

export function normalizeOutlookIntake(
  emails: OutlookIntakeEmail[],
  projectId: number,
): EmailIntakeItem[] {
  return emails
    .filter((email) => email.project?.id === projectId)
    .map((email) => {
      const closed = email.matchStatus.toLowerCase() === "ignored";
      return {
        key: `outlook:${email.id}`,
        source: "outlook",
        title: email.subject.trim() || "Untitled email",
        summary: email.bodyText?.trim() || email.body?.trim() || null,
        status: closed ? "ignored" : "matched",
        tab: closed ? "closed" : "open",
        occurredAt: email.receivedAt ?? email.createdAt,
        email,
      };
    });
}

export function mergeIntakeItems(
  tasks: TasksRow[],
  emails: OutlookIntakeEmail[],
  projectId: number,
): IntakeItem[] {
  return [...normalizeTaskIntake(tasks), ...normalizeOutlookIntake(emails, projectId)]
    .sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""));
}

export function intakeItemMatches(item: IntakeItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const sourceText =
    item.source === "task"
      ? [
          item.task.assignee_name,
          item.task.assignee_email,
          item.task.priority,
          item.task.source_system,
          item.task.source_title,
        ]
      : [
          item.email.fromName,
          item.email.fromEmail,
          item.email.project?.name,
          item.email.project?.projectNumber,
        ];

  return [item.title, item.summary, item.status, ...sourceText]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

export function resolveAdjacentIntakeKey(
  items: IntakeItem[],
  selectedKey: string | null,
  direction: "previous" | "next",
): string | null {
  if (items.length === 0) return null;
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.key === selectedKey),
  );
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (selectedIndex + offset + items.length) % items.length;
  return items[nextIndex]?.key ?? null;
}
