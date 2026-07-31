"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@/components/ds";
import { MoreVertical, Pencil, Trash2, Copy } from "lucide-react";

export function OverlaysSection() {
  return (
    <section id="overlays" className="scroll-mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">
          08
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Overlays
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Modal dialogs, sheets, popovers, and dropdown menus. Click each
            button to see the overlay in action.
          </p>
        </div>
      </div>

      <div className="grid gap-px rounded-xl overflow-hidden bg-border shadow-sm sm:grid-cols-2">
        {/* Dialog */}
        <div className="space-y-4 bg-card p-6">
          <h3 className="text-sm font-medium text-foreground">Dialog</h3>
          <p className="text-xs text-muted-foreground">
            Centered modal for confirmations and forms.
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Open Dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Item</DialogTitle>
                <DialogDescription>
                  Fill in the details below to create a new item.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="dialog-name">Name</Label>
                  <Input id="dialog-name" placeholder="Enter name..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sheet */}
        <div className="space-y-4 bg-card p-6">
          <h3 className="text-sm font-medium text-foreground">Sheet</h3>
          <p className="text-xs text-muted-foreground">
            Slide-in panel from the side for detail views.
          </p>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                Open Sheet
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Item Details</SheetTitle>
                <SheetDescription>
                  View and edit item properties.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sheet-name">Name</Label>
                  <Input id="sheet-name" defaultValue="Westfield Collective" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sheet-status">Status</Label>
                  <Input id="sheet-status" defaultValue="Active" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Popover */}
        <div className="space-y-4 bg-card p-6">
          <h3 className="text-sm font-medium text-foreground">Popover</h3>
          <p className="text-xs text-muted-foreground">
            Floating content panel anchored to a trigger.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Open Popover
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">
                  Filter by Status
                </h4>
                <p className="text-xs text-muted-foreground">
                  Choose which statuses to display in the table.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Dropdown Menu */}
        <div className="space-y-4 bg-card p-6">
          <h3 className="text-sm font-medium text-foreground">
            Dropdown Menu
          </h3>
          <p className="text-xs text-muted-foreground">
            Context menu with actions, typically on a row or card.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
