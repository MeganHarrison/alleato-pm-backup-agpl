import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  BarChart3,
  Building2,
  ClipboardList,
  DollarSign,
  FileText,
  HardHat,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "./button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta: Meta = {
  title: "Navigation/Command",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Inline = {
  name: "Inline command menu",
  render: () => (
    <Command className="rounded-lg border shadow-sm w-96">
      <CommandInput placeholder="Search anything..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Projects">
          <CommandItem>
            <Building2 />
            Vermillion Rise Warehouse
          </CommandItem>
          <CommandItem>
            <Building2 />
            Oakwood Office Complex
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tools">
          <CommandItem>
            <DollarSign />
            Budget
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <ClipboardList />
            Commitments
            <CommandShortcut>⌘C</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText />
            Change Orders
          </CommandItem>
          <CommandItem>
            <BarChart3 />
            Invoicing
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>
            <HardHat />
            Create RFI
          </CommandItem>
          <CommandItem>
            <Settings />
            Project Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

function CommandPaletteDialogDemo() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Search className="h-4 w-4" />
        Search...
        <kbd className="ml-2 rounded border bg-muted px-1.5 text-xs text-muted-foreground">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search projects, tools, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Projects">
            <CommandItem onSelect={() => setOpen(false)}>
              <Building2 />Vermillion Rise Warehouse
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              <Building2 />Oakwood Office Complex
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => setOpen(false)}>
              <HardHat />Create RFI
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              <DollarSign />New Change Order
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              <Settings />Project Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export const CommandPaletteDialog = {
  name: "Command palette (⌘K dialog)",
  render: () => <CommandPaletteDialogDemo />,
};
