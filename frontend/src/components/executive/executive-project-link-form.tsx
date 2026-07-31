"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { linkExecutiveSourceProjectAction } from "@/app/(main)/actions/executive-briefing-actions";
import { Button } from "@/components/ui/button";
import { InfoAlert } from "@/components/ds/InfoAlert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ExecutiveProjectOption = {
  id: number;
  name: string | null;
  projectNumber: string | null;
};

function projectOptionLabel(project: ExecutiveProjectOption) {
  if (project.projectNumber && project.name) {
    return `${project.projectNumber} - ${project.name}`;
  }
  return project.name ?? project.projectNumber ?? `Project ${project.id}`;
}

export function ExecutiveProjectLinkForm({
  sourceId,
  projects,
  currentProjectId,
  label,
}: {
  sourceId: string | null | undefined;
  projects: ExecutiveProjectOption[];
  currentProjectId?: number | null;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeProjectId = selectedProjectId ?? currentProjectId ?? null;
  const selectedProject = projects.find(
    (project) => project.id === activeProjectId,
  );

  if (!sourceId) return null;

  const linkProject = (projectId: number) => {
    const formData = new FormData();
    formData.set("sourceId", sourceId);
    formData.set("projectId", String(projectId));

    startTransition(async () => {
      try {
        setError(null);
        await linkExecutiveSourceProjectAction(formData);
        setSelectedProjectId(projectId);
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to link this source to a project.",
        );
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 rounded-md px-3 text-xs"
          disabled={isPending}
        >
          <span className="max-w-72 truncate">
            {isPending
              ? "Linking..."
              : selectedProject
                ? (label ?? "Change project")
                : (label ?? "Link project")}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.projectNumber ?? ""} ${project.name ?? ""}`}
                  onSelect={() => linkProject(project.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      activeProjectId === project.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{projectOptionLabel(project)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {error && (
          <div className="border-t p-2">
            <InfoAlert variant="error" className="text-xs">
              {error}
            </InfoAlert>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
