"use client";

import * as React from "react";
import { ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { headerSelectTriggerClassName } from "./header-control-styles";

interface Project {
  id: number;
  name: string | null;
  "job number": string | null;
}

interface ProjectSelectorProps {
  projectId: number | null;
  currentProject: Project | null;
  projects: Project[];
  loadingProjects: boolean;
  onFetchProjects: () => void;
  onProjectSelect: (projectId: number) => void;
  onViewAll: () => void;
}

export function ProjectSelector({
  projectId,
  currentProject,
  projects,
  loadingProjects,
  onFetchProjects,
  onProjectSelect,
  onViewAll,
}: ProjectSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) onFetchProjects();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "project-selector-trigger w-40 lg:w-48 xl:w-56",
            headerSelectTriggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {currentProject ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <span className="truncate text-xs text-foreground/80">
                  {currentProject.name}
                </span>
                {currentProject["job number"] && (
                  <span className="shrink-0 text-xs text-muted-foreground/60">
                    {currentProject["job number"]}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Select Project
              </span>
            )}
          </span>
          <ChevronDown
            className="h-3 w-3 shrink-0 text-muted-foreground/60"
            strokeWidth={1.6}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        collisionPadding={{ left: 60, right: 8 }}
        className="z-[110] border border-border p-0 shadow-sm"
        style={{ width: "min(340px, calc(100vw - 1rem))" }}
      >
        {/* Panel header */}
        <div className="border-b border-border/50 px-5 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Switch Project
          </span>
        </div>

        <Command
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search projects..."
            className="h-10 border-0 border-b border-border/40 px-4 text-sm focus:ring-0"
          />
          <CommandList className="max-h-72">
            {loadingProjects ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects…
              </div>
            ) : (
              <>
                <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                  No projects found
                </CommandEmpty>
                <CommandGroup className="p-2">
                  {projects.map((project) => {
                    const isSelected = project.id === projectId;
                    return (
                      <CommandItem
                        key={project.id}
                        value={`${project.name ?? ""}${project["job number"] ? ` ${project["job number"]}` : ""}`}
                        onSelect={() => {
                          onProjectSelect(project.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                          isSelected
                            ? "bg-muted text-foreground data-[selected=true]:bg-muted"
                            : "text-foreground/75 data-[selected=true]:bg-transparent data-[selected=true]:text-primary",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px]",
                              isSelected ? "font-semibold" : "font-normal",
                            )}
                          >
                            {project.name ?? "Unnamed Project"}
                          </span>
                          {project["job number"] && (
                            <span className="shrink-0 text-[11px] text-muted-foreground/60">
                              {project["job number"]}
                            </span>
                          )}
                        </div>
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-foreground",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                          strokeWidth={2}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>

        {/* Footer */}
        <div className="border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onViewAll();
              setOpen(false);
            }}
            className="flex h-auto w-full items-center justify-between rounded-none px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-transparent hover:text-primary"
          >
            View all projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
