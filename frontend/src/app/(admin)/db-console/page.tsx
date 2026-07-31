"use client";

import { useState } from "react";
import { Database } from "lucide-react";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ds/text";
import { useIsMobile } from "@/hooks/use-mobile";
import { SupabaseManagerDialog } from "@/components/platform-kit";

/**
 * Supabase management projects this console can drive. Refs are safe to expose
 * client-side — the Management API token stays server-only in the proxy; the
 * proxy enforces the Alleato admin check on every request.
 */
const PROJECTS = [
  { ref: "lgveqfnpkxvzbnnwuled", label: "PM App (primary database)" },
  { ref: "fqcvmfqldlewvbsuxdvz", label: "AI Database (RAG vector store)" },
] as const;

export default function DbConsolePage() {
  const isMobile = useIsMobile();
  const [projectRef, setProjectRef] = useState<string>(PROJECTS[0].ref);
  const [open, setOpen] = useState(false);

  const active = PROJECTS.find((p) => p.ref === projectRef) ?? PROJECTS[0];

  return (
    <PageShell
      variant="content"
      title="Supabase Console"
      description="Embedded Supabase management for the PM App and AI databases — tables, SQL editor, auth, storage, secrets, and logs. Admin only."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Text as="label" size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
            Project
          </Text>
          <Select value={projectRef} onValueChange={setProjectRef}>
            <SelectTrigger className="w-full sm:w-80" aria-label="Project">
              {/*
                Pass the label explicitly. A bare <SelectValue /> renders nothing
                until Radix mounts the (closed) content into a detached fragment
                and portals the selected item's text into the trigger — an async
                side-channel that is not guaranteed to land in the first commit,
                so the trigger paints blank. Explicit children render the label
                in the same pass as the value it comes from.
              */}
              <SelectValue>{active.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROJECTS.map((project) => (
                <SelectItem key={project.ref} value={project.ref}>
                  {project.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setOpen(true)}>
          <Database className="mr-2 h-4 w-4" />
          Open console
        </Button>
      </div>

      <Text size="sm" tone="muted" className="mt-3">
        Opening {active.label} · project ref{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{active.ref}</code>
      </Text>

      <SupabaseManagerDialog
        key={projectRef}
        projectRef={projectRef}
        open={open}
        onOpenChange={setOpen}
        isMobile={isMobile}
      />
    </PageShell>
  );
}
