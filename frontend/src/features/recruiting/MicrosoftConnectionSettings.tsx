"use client";

import { useState } from "react";
import { CalendarDays, Mail, PlugZap, Unplug } from "lucide-react";
import Link from "next/link";

import { SectionRuleHeading } from "@/components/layout";
import { Badge, Button, InfoAlert } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import type { RecruitingMicrosoftConnection } from "@/lib/recruiting/production-contracts";

export function MicrosoftConnectionSettings({
  connection,
  canManage,
}: {
  connection: RecruitingMicrosoftConnection;
  canManage: boolean;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect Microsoft 365 from Applicant Tracker? Recruiting will stop using this mailbox and calendar.",
      )
    ) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      await apiFetch("/api/recruiting/integrations/microsoft", {
        method: "DELETE",
      });
      window.location.assign("/recruiting?microsoft=disconnected");
    } catch {
      setError(
        "Microsoft 365 could not be disconnected. Reload and try again.",
      );
      setDisconnecting(false);
    }
  }

  return (
    <section
      aria-label="Microsoft 365 connections"
      className="rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap className="size-4" aria-hidden="true" />
            <SectionRuleHeading
              as="h3"
              label="Microsoft 365 connections"
              className="mb-0 pb-0"
            />
            <Badge variant={connection.connected ? "secondary" : "outline"}>
              {connection.connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Each user connects their own Alleato account. Applicant Tracker
            never asks you to paste a Microsoft password.
          </p>
          {connection.email ? (
            <p className="mt-2 text-sm">
              Connected as{" "}
              <span className="font-medium">{connection.email}</span>
            </p>
          ) : null}
        </div>
        {connection.connected && canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disconnecting}
            onClick={disconnect}
          >
            <Unplug className="mr-2 size-4" aria-hidden="true" />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <InfoAlert variant="error" role="alert" className="mt-3">
          {error}
        </InfoAlert>
      ) : null}
      {!canManage ? (
        <InfoAlert className="mt-3">
          A recruiter or recruiting administrator can manage Microsoft 365
          connections.
        </InfoAlert>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Outlook email</p>
              <p className="text-xs text-muted-foreground">
                Send recruiting messages as you.
              </p>
            </div>
          </div>
          {canManage ? (
            <Button
              asChild
              size="sm"
              variant={connection.mailConnected ? "outline" : "default"}
            >
              <Link
                href="/api/recruiting/integrations/microsoft/connect?capability=mail"
                aria-label={
                  connection.mailConnected
                    ? "Reconnect Outlook email"
                    : "Connect Outlook email"
                }
              >
                {connection.mailConnected ? "Reconnect" : "Connect"}
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Calendar and Teams</p>
              <p className="text-xs text-muted-foreground">
                Check availability and schedule interviews.
              </p>
            </div>
          </div>
          {canManage ? (
            <Button
              asChild
              size="sm"
              variant={connection.calendarConnected ? "outline" : "default"}
            >
              <Link
                href="/api/recruiting/integrations/microsoft/connect?capability=calendar"
                aria-label={
                  connection.calendarConnected
                    ? "Reconnect calendar and Teams"
                    : "Connect calendar and Teams"
                }
              >
                {connection.calendarConnected ? "Reconnect" : "Connect"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
