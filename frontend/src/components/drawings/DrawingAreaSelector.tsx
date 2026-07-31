"use client";

import React from "react";
import { Edit2, Folder, MoreVertical, Plus, Trash2 } from "lucide-react";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DrawingAreaWithCount } from "@/types/drawings.types";

interface DrawingAreaSelectorProps {
  areas: DrawingAreaWithCount[];
  selectedAreaId?: string;
  onSelectArea: (areaId: string | null) => void;
  onCreateArea?: (parentId?: string) => void;
  onEditArea?: (area: DrawingAreaWithCount) => void;
  onDeleteArea?: (area: DrawingAreaWithCount) => void;
  isLoading?: boolean;
  className?: string;
}

export function DrawingAreaSelector({
  areas,
  selectedAreaId,
  onSelectArea,
  onCreateArea,
  onEditArea,
  onDeleteArea,
  isLoading = false,
  className,
}: DrawingAreaSelectorProps) {
  // Build hierarchical structure
  const buildHierarchy = (areas: DrawingAreaWithCount[]): DrawingAreaWithCount[] => {
    const areaMap = new Map<string, DrawingAreaWithCount>();
    const rootAreas: DrawingAreaWithCount[] = [];

    // First pass: create map and initialize children arrays
    areas.forEach(area => {
      areaMap.set(area.id, { ...area, children: [] });
    });

    // Second pass: build hierarchy
    areas.forEach(area => {
      const areaWithChildren = areaMap.get(area.id)!;
      if (area.parent_area_id) {
        const parent = areaMap.get(area.parent_area_id);
        if (parent) {
          parent.children!.push(areaWithChildren);
        }
      } else {
        rootAreas.push(areaWithChildren);
      }
    });

    return rootAreas;
  };

  const hierarchicalAreas = buildHierarchy(areas);
  const totalDrawingCount = areas.reduce((sum, area) => sum + (area.drawing_count || 0), 0);

  const renderArea = (area: DrawingAreaWithCount, depth = 0): React.ReactNode => {
    const hasChildren = area.children && area.children.length > 0;
    const isSelected = selectedAreaId === area.id;

    return (
      <React.Fragment key={area.id}>
        <div
          className={cn(
            "group flex min-h-10 items-center gap-3 border-b border-border"
          )}
        >
          <Button
            variant="ghost"
            className="h-auto min-w-0 flex-1 justify-start rounded-none px-0 py-2 pr-3 font-normal hover:bg-transparent hover:text-current"
            style={{ paddingLeft: `${depth * 24}px` }}
            onClick={() => onSelectArea(area.id)}
            aria-current={isSelected ? "true" : undefined}
          >
            <Folder className={cn("h-4 w-4 shrink-0", hasChildren ? "text-foreground" : "text-muted-foreground")} />
            <span className={cn(
              "truncate text-sm",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {area.name}
            </span>
          </Button>

          <span className="shrink-0 pr-3 text-sm tabular-nums text-muted-foreground">
            {area.drawing_count}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mr-1 h-8 w-8 p-0 opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Actions for ${area.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCreateArea && (
                <DropdownMenuItem onClick={() => onCreateArea(area.id)}>
                  <Plus className="h-3 w-3 mr-2" />
                  Add Sub-Area
                </DropdownMenuItem>
              )}
              {onEditArea && (
                <DropdownMenuItem onClick={() => onEditArea(area)}>
                  <Edit2 className="h-3 w-3 mr-2" />
                  Edit Area
                </DropdownMenuItem>
              )}
              {onDeleteArea && area.drawing_count === 0 && (
                <DropdownMenuItem
                  onClick={() => onDeleteArea(area)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete Area
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && area.children!.map(child => renderArea(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (isLoading) {
    return (
      <section className={cn("space-y-3", className)}>
        <SectionRuleHeading label="Drawing Areas" className="mb-0" />
        <div className="border-t border-border">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex min-h-10 items-center gap-3 border-b border-border py-2">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-4 w-6 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <SectionRuleHeading label="Drawing Areas" className="mb-0" />
      {hierarchicalAreas.length === 0 ? (
        <div className="border-t border-border py-8 text-sm text-muted-foreground">
          No drawing areas created
        </div>
      ) : (
        <div className="border-t border-border">
          <div
            className={cn(
              "flex min-h-10 items-center gap-3 border-b border-border"
            )}
          >
            <Button
              variant="ghost"
              className="h-auto min-w-0 flex-1 justify-start rounded-none px-0 py-2 pr-3 font-normal hover:bg-transparent hover:text-current"
              onClick={() => onSelectArea(null)}
              aria-current={!selectedAreaId ? "true" : undefined}
            >
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn(
                "truncate text-sm",
                !selectedAreaId ? "text-primary" : "text-foreground"
              )}>
                All Drawings
              </span>
            </Button>
            <span className="shrink-0 pr-3 text-sm tabular-nums text-muted-foreground">
              {totalDrawingCount}
            </span>
          </div>

          {hierarchicalAreas.map(area => renderArea(area))}
        </div>
      )}
    </section>
  );
}
