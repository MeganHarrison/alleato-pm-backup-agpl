import * as React from "react"
import { Plus, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface BudgetCode {
  id: string
  code: string
  costType: string | null
  costTypeId?: string | null
  description: string
  fullLabel: string
}

interface BudgetCodeSelectorProps {
  value?: string
  onValueChange: (value: string, code: BudgetCode) => void
  onCreateNew?: () => void
  placeholder?: string
  budgetCodes: BudgetCode[]
  loading?: boolean
  disabled?: boolean
  error?: boolean
  className?: string
}

/**
 * Enhanced budget code selector with improved UX
 * Features:
 * - Keyboard navigation support
 * - Smart filtering and search
 * - Clear visual hierarchy
 * - Create new budget code integration
 */
function BudgetCodeSelector({
  value = "",
  onValueChange,
  onCreateNew,
  placeholder = "Select budget code...",
  budgetCodes = [],
  loading = false,
  disabled = false,
  error = false,
  className,
}: BudgetCodeSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const commandListId = React.useId()

  const selectedCode = budgetCodes.find(code => code.id === value)

  // Filter codes based on search query
  const filteredCodes = React.useMemo(() => {
    if (!searchQuery.trim()) return budgetCodes

    const query = searchQuery.toLowerCase()
    return budgetCodes.filter(code =>
      code.fullLabel.toLowerCase().includes(query) ||
      code.code.toLowerCase().includes(query) ||
      code.description.toLowerCase().includes(query)
    )
  }, [budgetCodes, searchQuery])

  // Group codes by cost type for better organization
  const groupedCodes = React.useMemo(() => {
    const groups: Record<string, BudgetCode[]> = {}

    filteredCodes.forEach(code => {
      const type = code.costType || "Other"
      if (!groups[type]) groups[type] = []
      groups[type].push(code)
    })

    return groups
  }, [filteredCodes])

  const handleSelect = (codeId: string) => {
    const code = budgetCodes.find(c => c.id === codeId)
    if (code) {
      onValueChange(codeId, code)
      setOpen(false)
      setSearchQuery("")
    }
  }

  const handleCreateNew = () => {
    setOpen(false)
    setSearchQuery("")
    onCreateNew?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={commandListId}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between px-4 py-2 text-sm font-normal",
            error && "border-destructive",
            !selectedCode && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left">
            {loading
              ? "Loading..."
              : selectedCode
                ? selectedCode.fullLabel
                : placeholder
            }
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,90vw)] p-0" align="start" sideOffset={0}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search budget codes..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="border-0 focus:ring-0"
          />
          <CommandList id={commandListId} className="max-h-[300px]">
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-center">
                  <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Loading budget codes...</span>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? `No budget codes found for "${searchQuery}"`
                    : "No budget codes found"
                  }
                </div>
              )}
            </CommandEmpty>

            {/* Grouped Budget Codes */}
            {Object.entries(groupedCodes).map(([costType, codes]) => (
              <CommandGroup key={costType} heading={costType}>
                {codes.map((code) => (
                  <CommandItem
                    key={code.id}
                    value={code.id}
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-foreground">
                        {code.fullLabel}
                      </div>
                      {code.description && (
                        <div className="text-xs text-muted-foreground">
                          {code.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {/* Create New Option */}
            {onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCreateNew} className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    <span className="text-primary font-medium">Create New Budget Code</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { BudgetCodeSelector, type BudgetCodeSelectorProps }
