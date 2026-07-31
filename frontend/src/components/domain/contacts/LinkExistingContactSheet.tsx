"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { UserPlus, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LinkExistingContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  excludeContactIds?: string[];
  onContactLinked: (personId: string) => Promise<void>;
}

interface Person {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_id: string | null;
}

export function LinkExistingContactSheet({
  open,
  onOpenChange,
  vendorId,
  excludeContactIds = [],
  onContactLinked,
}: LinkExistingContactSheetProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!open) return;

    const fetchPeople = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("people")
          .select("id, first_name, last_name, email, company_id")
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true });

        if (error) throw new Error(error.message);
        setPeople((data || []) as Person[]);
        setSelectedPersonId("");
        setSearchTerm("");
      } catch (error) {
        toast.error("Failed to load contacts");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeople();
  }, [open]);

  const availablePeople = people.filter(
    (person) => !excludeContactIds.includes(person.id)
  );

  const selectedPerson = availablePeople.find((p) => p.id === selectedPersonId);

  const handleLinkContact = async () => {
    if (!selectedPersonId) {
      toast.error("Please select a contact");
      return;
    }

    setIsLinking(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("vendor_contacts").insert({
        company_id: vendorId,
        person_id: selectedPersonId,
      });

      if (error) {
        // Check if it's a duplicate error
        if (error.code === "23505") {
          toast.error("This contact is already linked to the vendor");
        } else {
          throw error;
        }
      } else {
        toast.success("Contact linked successfully");
        await onContactLinked(selectedPersonId);
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to link contact");
    } finally {
      setIsLinking(false);
    }
  };

  const displayLabel = selectedPerson
    ? `${selectedPerson.first_name || ""} ${selectedPerson.last_name || ""}`.trim() ||
      selectedPerson.email ||
      "Unknown Contact"
    : "Select a contact...";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Existing Contact
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact</label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className="w-full justify-between"
                      disabled={availablePeople.length === 0}
                    >
                      <span className={cn(!selectedPersonId && "text-muted-foreground")}>
                        {displayLabel}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList className="max-h-64">
                        {availablePeople.length === 0 ? (
                          <CommandEmpty>
                            {excludeContactIds.length > 0
                              ? "All contacts are already linked"
                              : "No contacts found"}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {availablePeople
                              .filter((person) => {
                                if (!searchTerm) return true;
                                const term = searchTerm.toLowerCase();
                                return [
                                  person.first_name,
                                  person.last_name,
                                  person.email,
                                ].some((val) =>
                                  val?.toLowerCase().includes(term)
                                );
                              })
                              .map((person) => {
                                const label =
                                  `${person.first_name || ""} ${
                                    person.last_name || ""
                                  }`.trim() || person.email || "Unknown Contact";
                                return (
                                  <CommandItem
                                    key={person.id}
                                    value={person.id}
                                    onSelect={() => {
                                      setSelectedPersonId(person.id);
                                      setPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedPersonId === person.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col gap-0.5">
                                      <span>{label}</span>
                                      {person.email && (
                                        <span className="text-xs text-muted-foreground">
                                          {person.email}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={handleLinkContact}
                disabled={!selectedPersonId || isLinking}
                className="w-full"
              >
                {isLinking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Link Contact
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
