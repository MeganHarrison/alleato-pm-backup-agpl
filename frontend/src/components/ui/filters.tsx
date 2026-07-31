'use client';

import * as React from 'react';
import { ChevronDown, Filter, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterType = 'enum' | 'string' | 'number' | 'date' | 'boolean';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  type: FilterType;
  icon?: React.ReactNode;
  /** Available options for 'enum' filters */
  options?: FilterOption[];
  /** Override the default first operator */
  defaultOperator?: string;
}

export interface ActiveFilter {
  id: string;
  operator: string;
  value: string | string[] | number | boolean | null;
}

// ─── Operator registry ────────────────────────────────────────────────────────

const OPERATORS: Record<FilterType, { value: string; label: string }[]> = {
  enum: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  string: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: "doesn't contain" },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
  date: [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'on', label: 'on' },
  ],
  boolean: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
};

function firstOperator(type: FilterType): string {
  return OPERATORS[type][0].value;
}

function initValue(type: FilterType): ActiveFilter['value'] {
  if (type === 'enum') return [];
  if (type === 'boolean') return true;
  return '';
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface FiltersContextValue {
  filters: FilterDef[];
  activeFilters: ActiveFilter[];
  addFilter: (id: string) => void;
  updateFilter: (id: string, patch: Partial<Omit<ActiveFilter, 'id'>>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
}

const FiltersContext = React.createContext<FiltersContextValue>({
  filters: [],
  activeFilters: [],
  addFilter: () => {},
  updateFilter: () => {},
  removeFilter: () => {},
  clearFilters: () => {},
});

export function useFilters() {
  return React.useContext(FiltersContext);
}

// ─── FiltersProvider ──────────────────────────────────────────────────────────

export interface FiltersProviderProps {
  /** Available filter definitions */
  filters: FilterDef[];
  /** Pre-applied filters on first render */
  defaultFilters?: ActiveFilter[];
  /** Called whenever the active filter set changes */
  onChange?: (active: ActiveFilter[]) => void;
  children: React.ReactNode;
}

export function FiltersProvider({
  filters,
  defaultFilters = [],
  onChange,
  children,
}: FiltersProviderProps) {
  const [active, setActive] = React.useState<ActiveFilter[]>(defaultFilters);

  const commit = (next: ActiveFilter[]) => {
    setActive(next);
    onChange?.(next);
  };

  const addFilter = (id: string) => {
    if (active.find((f) => f.id === id)) return;
    const def = filters.find((f) => f.id === id);
    if (!def) return;
    commit([
      ...active,
      {
        id,
        operator: def.defaultOperator ?? firstOperator(def.type),
        value: initValue(def.type),
      },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<Omit<ActiveFilter, 'id'>>) => {
    commit(active.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFilter = (id: string) => {
    commit(active.filter((f) => f.id !== id));
  };

  const clearFilters = () => commit([]);

  return (
    <FiltersContext.Provider
      value={{ filters, activeFilters: active, addFilter, updateFilter, removeFilter, clearFilters }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

// ─── FiltersAddButton ─────────────────────────────────────────────────────────

export interface FiltersAddButtonProps {
  label?: string;
  className?: string;
}

export function FiltersAddButton({ label = 'Add filter', className }: FiltersAddButtonProps) {
  const { filters, activeFilters, addFilter } = useFilters();
  const available = filters.filter((f) => !activeFilters.find((a) => a.id === f.id));

  if (!available.length && !activeFilters.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1.5 text-muted-foreground', !available.length && 'opacity-40 pointer-events-none', className)}
          disabled={!available.length}
        >
          <Filter className="h-3.5 w-3.5" />
          {label}
          {activeFilters.length > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {available.map((filter) => (
          <DropdownMenuItem
            key={filter.id}
            onSelect={() => addFilter(filter.id)}
            className="gap-2 text-sm"
          >
            {filter.icon && <span className="h-4 w-4 text-muted-foreground">{filter.icon}</span>}
            {filter.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── ActiveFiltersList ────────────────────────────────────────────────────────

export interface ActiveFiltersListProps {
  className?: string;
}

export function ActiveFiltersList({ className }: ActiveFiltersListProps) {
  const { activeFilters, clearFilters } = useFilters();

  if (!activeFilters.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {activeFilters.map((filter) => (
        <ActiveFilterChip key={filter.id} filter={filter} />
      ))}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={clearFilters}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

// ─── ActiveFilter chip ────────────────────────────────────────────────────────

export interface ActiveFilterProps {
  filter: ActiveFilter;
  className?: string;
}

function ActiveFilterChip({ filter, className }: ActiveFilterProps) {
  const { filters, updateFilter, removeFilter } = useFilters();
  const def = filters.find((f) => f.id === filter.id);
  if (!def) return null;

  const operators = OPERATORS[def.type];
  const currentOp = operators.find((o) => o.value === filter.operator) ?? operators[0];

  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-border bg-muted/30 text-xs overflow-hidden divide-x divide-border',
        className,
      )}
    >
      {/* Label */}
      <span className="px-2 py-1 font-medium text-foreground whitespace-nowrap">
        {def.label}
      </span>

      {/* Operator */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto rounded-none px-1.5 py-1 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground gap-0.5"
          >
            {currentOp.label}
            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36 text-xs">
          {operators.map((op) => (
            <DropdownMenuItem
              key={op.value}
              onSelect={() => updateFilter(filter.id, { operator: op.value })}
              className={cn('text-xs', filter.operator === op.value && 'font-medium')}
            >
              {op.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Value */}
      <FilterValueTrigger filter={filter} def={def} />

      {/* Remove */}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto rounded-none px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => removeFilter(filter.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Value trigger + popover ──────────────────────────────────────────────────

function FilterValueTrigger({ filter, def }: { filter: ActiveFilter; def: FilterDef }) {
  const { updateFilter } = useFilters();
  const [open, setOpen] = React.useState(false);

  const displayValue = getDisplayValue(filter, def);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto rounded-none px-2 py-1 text-xs font-medium text-foreground hover:bg-muted gap-0.5 max-w-36"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <FilterValueInput
          filter={filter}
          def={def}
          onChange={(value) => {
            updateFilter(filter.id, { value });
            if (def.type !== 'enum') setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function getDisplayValue(filter: ActiveFilter, def: FilterDef): string {
  if (def.type === 'boolean') {
    return filter.value ? 'True' : 'False';
  }
  if (def.type === 'enum') {
    const vals = (filter.value as string[]) ?? [];
    if (!vals.length) return 'Select…';
    if (vals.length === 1) {
      return def.options?.find((o) => o.value === vals[0])?.label ?? vals[0];
    }
    return `${vals.length} selected`;
  }
  if (filter.value === null || filter.value === undefined || filter.value === '') {
    return 'Enter…';
  }
  return String(filter.value);
}

// ─── Value input per type ─────────────────────────────────────────────────────

function FilterValueInput({
  filter,
  def,
  onChange,
}: {
  filter: ActiveFilter;
  def: FilterDef;
  onChange: (value: ActiveFilter['value']) => void;
}) {
  if (def.type === 'enum' && def.options) {
    const selected = (filter.value as string[]) ?? [];
    return (
      <div className="space-y-0.5 max-h-52 overflow-y-auto">
        {def.options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((v) => v !== opt.value);
                onChange(next);
              }}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  if (def.type === 'boolean') {
    return (
      <div className="space-y-0.5">
        {[
          { value: true, label: 'True' },
          { value: false, label: 'False' },
        ].map((opt) => (
          <label
            key={String(opt.value)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
          >
            <input
              type="radio"
              checked={filter.value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  if (def.type === 'number') {
    return (
      <input
        type="number"
        defaultValue={(filter.value as number | string) ?? ''}
        onBlur={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onChange(Number((e.target as HTMLInputElement).value));
        }}
        placeholder="e.g. 100"
        autoFocus
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  if (def.type === 'date') {
    return (
      <input
        type="date"
        defaultValue={(filter.value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        autoFocus
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  // string
  return (
    <input
      type="text"
      defaultValue={(filter.value as string) ?? ''}
      onBlur={(e) => onChange(e.target.value || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onChange((e.target as HTMLInputElement).value || null);
      }}
      placeholder="Search"
      autoFocus
      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

// ─── FilterBadge (standalone, no context) ─────────────────────────────────────

/** Minimal read-only filter badge — for display without provider context */
export function FilterBadge({
  label,
  operator,
  value,
  onRemove,
  className,
}: {
  label: string;
  operator: string;
  value: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-border bg-muted/30 text-xs overflow-hidden divide-x divide-border',
        className,
      )}
    >
      <span className="px-2 py-1 font-medium text-foreground">{label}</span>
      <span className="px-1.5 py-1 text-muted-foreground">{operator}</span>
      <span className="px-2 py-1 font-medium text-foreground">{value}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto rounded-none px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ─── NoFilteredResults ────────────────────────────────────────────────────────

export interface NoFilteredResultsProps {
  onClear?: () => void;
  className?: string;
}

export function NoFilteredResults({ onClear, className }: NoFilteredResultsProps) {
  const { clearFilters } = useFilters();
  const handleClear = onClear ?? clearFilters;

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <Filter className="h-8 w-8 text-muted-foreground/30" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">No results match your filters</p>
        <p className="text-xs text-muted-foreground">Try adjusting or clearing your filters.</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleClear}>
        Clear filters
      </Button>
    </div>
  );
}
