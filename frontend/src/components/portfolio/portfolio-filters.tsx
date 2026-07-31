"use client";
/* eslint-disable design-system/no-raw-heading */

import * as React from "react";
import {
  Search,
  List,
  LayoutGrid,
  Filter,
  X,
  SlidersHorizontal,
  ChevronDown,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PortfolioViewType } from "@/types/portfolio";
import { cn } from "@/lib/utils";

interface PortfolioFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewType: PortfolioViewType;
  onViewTypeChange: (type: PortfolioViewType) => void;
  onClearFilters?: () => void;
  // Primary filter (phase for projects, stage for other pages)
  phaseFilter?: string | null;
  onPhaseFilterChange?: (value: string | null) => void;
  phaseOptions?: string[];
  // Secondary filter (category for projects, type for other pages)
  categoryFilter?: string | null;
  onCategoryFilterChange?: (value: string | null) => void;
  categoryOptions?: string[];
  // Tertiary filter (client for projects)
  clientFilter?: string | null;
  onClientFilterChange?: (value: string | null) => void;
  clientOptions?: string[];
  // Action buttons for mobile
  onExport?: (format: "pdf" | "csv") => void;
  onCreateProject?: () => void;
  // Legacy props for backwards compatibility
  statusFilter?: any;
  onStatusFilterChange?: (value: any) => void;
  stageFilter?: string | null;
  onStageFilterChange?: (value: string | null) => void;
  stageOptions?: string[];
  stageLabel?: string;
  typeFilter?: string | null;
  onTypeFilterChange?: (value: string | null) => void;
  typeOptions?: string[];
  typeLabel?: string;
  hideViewToggle?: boolean;
}

export function PortfolioFilters({
  searchQuery,
  onSearchChange,
  viewType,
  onViewTypeChange,
  onClearFilters,
  phaseFilter,
  onPhaseFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  clientFilter,
  onClientFilterChange,
  phaseOptions,
  categoryOptions,
  clientOptions,
  onExport,
  onCreateProject,
  hideViewToggle = false,
}: PortfolioFiltersProps) {
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);

  const viewTypes: {
    value: PortfolioViewType;
    icon: React.ElementType;
    label: string;
  }[] = [
    { value: "list", icon: List, label: "List View" },
    { value: "thumbnails", icon: LayoutGrid, label: "Thumbnails View" },
  ];

  const activeFiltersCount = [phaseFilter, categoryFilter, clientFilter].filter(
    (value) => value && value.length > 0,
  ).length;

  return (
    <div className="flex items-center justify-between py-4 gap-4">
      {/* Mobile: Compact layout with filter sheet */}
      <div className="flex lg:hidden items-center gap-2 flex-1">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Filter Sheet Trigger */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="relative h-9 shrink-0 px-2.5 border-border hover:border-border/80"
            >
              <SlidersHorizontal />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] flex flex-col">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Filters & Views</SheetTitle>
              <SheetDescription className="text-xs">
                Filter projects and change view type
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-6 space-y-4">
              {/* View Type Selection */}
              {!hideViewToggle && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    View Type
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {viewTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          type="button"
                          variant="outline"
                          key={type.value}
                          onClick={() => {
                            onViewTypeChange(type.value);
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 h-auto rounded-lg transition-all",
                            viewType === type.value
                              ? "border-brand bg-brand/5 text-brand"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-border",
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[10px] font-medium">
                            {type.label.split(" ")[0]}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Client Filter */}
              {onClientFilterChange && clientOptions && clientOptions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Client
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {clientOptions?.map((client) => (
                      <Button
                        type="button"
                        variant="outline"
                        key={client}
                        onClick={() => {
                          onClientFilterChange(
                            client === clientFilter ? null : client,
                          );
                        }}
                        className={cn(
                          "px-4 py-1.5 h-auto text-xs rounded-full transition-all",
                          clientFilter === client
                            ? "border-brand bg-brand/10 text-brand font-medium"
                            : "border-border text-foreground hover:border-border/80",
                        )}
                      >
                        {client}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase Filter */}
              {onPhaseFilterChange && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phase</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onPhaseFilterChange(null)}
                      className={cn(
                        "px-4 py-1.5 h-auto text-xs rounded-full transition-all",
                        !phaseFilter
                          ? "border-brand bg-brand/10 text-brand font-medium"
                          : "border-border text-foreground hover:border-border/80",
                      )}
                    >
                      All
                    </Button>
                    {phaseOptions?.map((phase) => (
                      <Button
                        type="button"
                        variant="outline"
                        key={phase}
                        onClick={() => onPhaseFilterChange(phase)}
                        className={cn(
                          "px-4 py-1.5 h-auto text-xs rounded-full transition-all capitalize",
                          phaseFilter === phase
                            ? "border-brand bg-brand/10 text-brand font-medium"
                            : "border-border text-foreground hover:border-border/80",
                        )}
                      >
                        {phase}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Filter */}
              {onCategoryFilterChange && categoryOptions && categoryOptions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Category
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions?.map((category) => (
                      <Button
                        type="button"
                        variant="outline"
                        key={category}
                        onClick={() => {
                          onCategoryFilterChange(
                            category === categoryFilter ? null : category,
                          );
                        }}
                        className={cn(
                          "px-4 py-1.5 h-auto text-xs rounded-full transition-all",
                          categoryFilter === category
                            ? "border-brand bg-brand/10 text-brand font-medium"
                            : "border-border text-foreground hover:border-border/80",
                        )}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear All Button */}
              {activeFiltersCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onClearFilters?.();
                    setFilterSheetOpen(false);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Export dropdown - Mobile */}
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-brand text-white hover:bg-brand/90 h-9 px-2 shrink-0">
                <FileText />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("pdf")}>
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("csv")}>
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Create Project - Mobile */}
        {onCreateProject && (
          <Button
            onClick={onCreateProject}
            className="bg-brand text-white hover:bg-brand/90 h-9 px-2 shrink-0"
          >
            <Plus />
          </Button>
        )}
      </div>

      {/* Desktop: Full layout */}
      <div className="hidden lg:flex items-center gap-4 flex-1">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 w-80 h-10 border-border focus:border-brand"
          />
        </div>

        {/* Filter popover */}
        {(onClientFilterChange || onPhaseFilterChange || onCategoryFilterChange) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative h-10 w-10 border-border hover:border-border/80"
                aria-label="Open filters"
              >
                <Filter />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Filters</p>

                {onClientFilterChange && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Client
                    </span>
                    <Select
                      value={clientFilter || "all"}
                      onValueChange={(value) =>
                        onClientFilterChange(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {clientOptions?.map((client) => (
                          <SelectItem key={client} value={client}>
                            {client}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {onPhaseFilterChange && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Phase
                    </span>
                    <Select
                      value={phaseFilter || "all"}
                      onValueChange={(value) =>
                        onPhaseFilterChange(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm capitalize">
                        <SelectValue placeholder="All Phases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Phases</SelectItem>
                        {phaseOptions?.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            <span className="capitalize">{phase}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {onCategoryFilterChange && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Category
                    </span>
                    <Select
                      value={categoryFilter || "all"}
                      onValueChange={(value) =>
                        onCategoryFilterChange(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categoryOptions?.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {activeFiltersCount > 0 && (
                  <>
                    <div className="h-px bg-border" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-xs"
                      onClick={onClearFilters}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}


        {/* Clear all button */}
        {(activeFiltersCount > 0 || searchQuery) && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClearFilters}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
            Clear All
          </Button>
        )}
      </div>

      {/* Desktop action buttons */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Export dropdown - Desktop */}
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 text-sm border-border hover:border-border/80">
                <FileText />
                Export
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("pdf")}>
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("csv")}>
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Create Project - Desktop */}
        {onCreateProject && (
          <Button
            onClick={onCreateProject}
            className="bg-brand text-white hover:bg-brand/90 h-10 text-sm"
          >
            <Plus />
            Create Project
          </Button>
        )}
      </div>

      {/* View type toggles - Desktop only */}
      {!hideViewToggle && (
        <div className="hidden lg:flex items-center gap-1 border rounded-md p-0.5">
          {viewTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                key={type.value}
                onClick={() => onViewTypeChange(type.value)}
                className={cn(
                  "h-8 w-8 rounded transition-colors",
                  viewType === type.value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                title={type.label}
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
