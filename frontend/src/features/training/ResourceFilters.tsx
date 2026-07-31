"use client";

import { useState } from "react";
import { Search } from "lucide-react";

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
import { cn } from "@/lib/utils";

import { EMPTY_TRAINING_LIBRARY_FILTERS } from "./types";
import type {
  TrainingLibraryFilters,
  TrainingResourceLevel,
  TrainingResourceType,
  TrainingRoleOption,
} from "./types";

const TYPE_LABELS: Record<TrainingResourceType, string> = {
  video: "Video",
  course: "Course",
  doc: "Document",
};

const LEVEL_LABELS: Record<TrainingResourceLevel, string> = {
  intro: "Intro",
  "deep-dive": "Deep dive",
};

interface ResourceFiltersProps {
  roles: TrainingRoleOption[];
  tracks: string[];
  value: TrainingLibraryFilters;
  onChange: (next: TrainingLibraryFilters) => void;
  className?: string;
}

function formatTrackLabel(track: string) {
  if (track.toLowerCase() === "pm") return "Project Management";
  return track
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ResourceFilters({
  roles,
  tracks,
  value,
  onChange,
  className,
}: ResourceFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasActiveFilters =
    value.roleId !== null ||
    value.track !== null ||
    value.type !== null ||
    value.level !== null ||
    value.search.trim().length > 0;

  return (
    <section
      aria-label="Resource filters"
      className={cn("space-y-2", className)}
    >
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-4">
        <div
          id="training-secondary-filters"
          className={cn(
            "order-3 hidden w-full grid-cols-2 gap-3",
            filtersOpen && "grid",
            "lg:order-1 lg:flex lg:w-auto lg:shrink-0 lg:gap-4",
          )}
        >
          <FilterSelect
            id="training-role-filter"
            label="Role"
            value={value.roleId ?? "all"}
            options={[
              { value: "all", label: "Role" },
              ...roles.map((role) => ({
                value: role.id,
                label: role.name,
              })),
            ]}
            onValueChange={(next) =>
              onChange({ ...value, roleId: next === "all" ? null : next })
            }
          />

          <FilterSelect
            id="training-track-filter"
            label="Track"
            value={value.track ?? "all"}
            options={[
              { value: "all", label: "Track" },
              ...tracks.map((track) => ({
                value: track,
                label: formatTrackLabel(track),
              })),
            ]}
            onValueChange={(next) =>
              onChange({ ...value, track: next === "all" ? null : next })
            }
          />

          <FilterSelect
            id="training-type-filter"
            label="Format"
            value={value.type ?? "all"}
            options={[
              { value: "all", label: "Format" },
              ...(Object.keys(TYPE_LABELS) as TrainingResourceType[]).map(
                (type) => ({
                  value: type,
                  label: TYPE_LABELS[type],
                }),
              ),
            ]}
            onValueChange={(next) =>
              onChange({
                ...value,
                type: next === "all" ? null : (next as TrainingResourceType),
              })
            }
          />

          <FilterSelect
            id="training-level-filter"
            label="Depth"
            value={value.level ?? "all"}
            options={[
              { value: "all", label: "Depth" },
              ...(Object.keys(LEVEL_LABELS) as TrainingResourceLevel[]).map(
                (level) => ({
                  value: level,
                  label: LEVEL_LABELS[level],
                }),
              ),
            ]}
            onValueChange={(next) =>
              onChange({
                ...value,
                level: next === "all" ? null : (next as TrainingResourceLevel),
              })
            }
          />
        </div>

        <div className="relative order-1 min-w-48 flex-1 lg:order-2 lg:max-w-[280px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Label htmlFor="training-resource-search" className="sr-only">
            Search resources
          </Label>
          <Input
            id="training-resource-search"
            type="search"
            value={value.search}
            onChange={(event) =>
              onChange({ ...value, search: event.currentTarget.value })
            }
            placeholder="Search"
            aria-label="Search training resources"
            className="h-11 bg-background pl-9 sm:h-10"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="order-2 h-11 shrink-0 sm:h-10 lg:hidden"
          aria-controls="training-secondary-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
        </Button>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="order-4 h-11 shrink-0 px-2 text-muted-foreground sm:h-10 lg:order-3"
            onClick={() => onChange(EMPTY_TRAINING_LIBRARY_FILTERS)}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (next: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="h-11 w-full bg-background text-sm sm:h-10 lg:w-[120px]"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
