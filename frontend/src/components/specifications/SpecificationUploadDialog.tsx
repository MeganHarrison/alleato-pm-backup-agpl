"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, FileText, Loader2, Plus, Upload, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { SectionRuleHeading } from "@/components/layout/spacing";
import { useCreateSpecification, useSpecifications } from "@/hooks/use-specifications";
import {
  uploadSpecificationSchema,
  type UploadSpecificationFormData,
} from "@/lib/schemas/specification-schemas";

interface SpecificationUploadDialogProps {
  projectId: string;
  children?: React.ReactNode;
  onUploadComplete?: () => void;
}

export function SpecificationUploadDialog({
  projectId,
  children,
  onUploadComplete,
}: SpecificationUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [setPickerOpen, setSetPickerOpen] = useState(false);

  const createMutation = useCreateSpecification(projectId);
  const { data: existingSpecifications } = useSpecifications(projectId, {
    page: 1,
    page_size: 200,
  });

  const existingSets = useMemo(() => {
    const uniqueTitles = new Set<string>();
    for (const spec of existingSpecifications?.specifications ?? []) {
      const title = spec.title?.trim();
      if (title) uniqueTitles.add(title);
    }
    return Array.from(uniqueTitles).sort((a, b) => a.localeCompare(b));
  }, [existingSpecifications?.specifications]);

  const form = useForm<UploadSpecificationFormData>({
    resolver: zodResolver(uploadSpecificationSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      specification_set_name: "",
      specification_set_instructions: "",
      format: "masterformat_csi",
      default_issue_date: "",
      default_receive_date: "",
      default_revision_instruction: "",
      number_to_ignore: "",
      specifications_language: "english",
      area_ids: [],
      subscriber_ids: [],
    },
  });

  const selectedFormat = form.watch("format");
  const watchedSetName = form.watch("specification_set_name");
  const normalizedWatchedSetName = watchedSetName.trim().toLowerCase();
  const hasExactSetMatch = existingSets.some(
    (setName) => setName.trim().toLowerCase() === normalizedWatchedSetName
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      form.setError("file", {
        type: "manual",
        message: "File must be under 50MB",
      });
      return;
    }

    setSelectedFile(file);
    form.setValue("file", file);
    form.clearErrors("file");
  };

  const removeFile = () => {
    setSelectedFile(null);
    form.resetField("file");
  };

  const handleSubmit = async (data: UploadSpecificationFormData) => {
    try {
      await createMutation.mutateAsync(data);
      form.reset();
      setSelectedFile(null);
      setSetPickerOpen(false);
      setOpen(false);
      onUploadComplete?.();
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Upload />
            Upload Specification
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Specifications</DialogTitle>
          <DialogDescription>
            Upload attached files and set the default import configuration. Max file size is 50MB.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="file"
              render={() => (
                <FormItem>
                  <FormLabel>Attached Files *</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {!selectedFile ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-border transition-colors">
                          <Input
                            type="file"
                            accept="*/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-upload"
                          />
                          <label
                            htmlFor="file-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium text-primary hover:text-primary/80">
                                Click to upload
                              </span>{" "}
                              or drag and drop
                            </div>
                            <p className="text-xs text-muted-foreground">Any file type (max 50MB)</p>
                          </label>
                        </div>
                      ) : (
                        <div className="border border-border rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <FileText className="h-8 w-8 text-red-500" />
                            <div>
                              <p className="text-sm font-medium">{selectedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(selectedFile.size)}
                              </p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specification_set_name"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Specification Set *</FormLabel>
                  <FormDescription>
                    Search an existing set or type a new set name.
                  </FormDescription>
                  <Popover open={setPickerOpen} onOpenChange={setSetPickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">{field.value || "Select or create a specification set"}</span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search for a set or type a new name"
                          value={field.value}
                          onValueChange={(value) => field.onChange(value)}
                        />
                        <CommandList>
                          {normalizedWatchedSetName.length > 0 && !hasExactSetMatch && (
                            <CommandGroup heading="Create">
                              <CommandItem
                                value={`create-${watchedSetName}`}
                                onSelect={() => {
                                  field.onChange(watchedSetName.trim());
                                  setSetPickerOpen(false);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {`Create "${watchedSetName.trim()}"`}
                              </CommandItem>
                            </CommandGroup>
                          )}
                          <CommandEmpty>
                            <div className="px-2 py-3 text-sm">
                              No matches. Keep typing to create a new set.
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {existingSets.map((setName) => (
                              <CommandItem
                                key={setName}
                                value={setName}
                                onSelect={(value) => {
                                  field.onChange(value);
                                  setSetPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === setName ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {setName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specification_set_instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specification Set Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter instructions for this specification set"
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="masterformat_csi">MasterFormat, by CSI (USA/Canada)</SelectItem>
                      <SelectItem value="ncs_natspec">NCS, by NATSPEC (AUSTRALIA)</SelectItem>
                      <SelectItem value="no_or_other_format">NO FORMAT/OTHER FORMAT</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="default_issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Issue Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_receive_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Receive Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <section className="space-y-4">
              <div className="space-y-1">
                <SectionRuleHeading label="Advanced Options" />
              </div>

              <FormField
                control={form.control}
                name="default_revision_instruction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Revision Instructions</FormLabel>
                    <FormDescription>
                      Enter your specification set default revision number or letter, if applicable.
                    </FormDescription>
                    <FormControl>
                      <Input
                        placeholder="Enter your specification set default revision number or letter"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number_to_ignore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number to Ignore</FormLabel>
                    <FormDescription>
                      Enter any number here that should be ignored as a spec section number.
                    </FormDescription>
                    <FormControl>
                      <Input
                        placeholder="Enter a number to ignore as a spec section number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specifications_language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specifications Language</FormLabel>
                    <FormDescription>
                      Only CSI MasterFormat supports languages other than English.
                    </FormDescription>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish" disabled={selectedFormat !== "masterformat_csi"}>
                          Spanish
                        </SelectItem>
                        <SelectItem value="french" disabled={selectedFormat !== "masterformat_csi"}>
                          French
                        </SelectItem>
                        <SelectItem value="portuguese" disabled={selectedFormat !== "masterformat_csi"}>
                          Portuguese
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex justify-end space-x-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !selectedFile}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upload
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
