# Form Page Archetype System
## The Definitive Reference for All Form Pages in Alleato PM

**STOP.** Before you write a single line of form code, read this document from start to finish. It is not optional. Every form in this application must conform to one of the three tiers defined here. No exceptions.

This document replaces improvised judgment with copy-paste certainty. Every pattern below is production-ready.

---

## Table of Contents

1. [The Three Tiers — Decision Tree](#the-three-tiers)
2. [Tier 1: Simple Form — ASCII Wireframe + Code](#tier-1-simple-form)
3. [Tier 2: Standard Form — ASCII Wireframe + Code](#tier-2-standard-form)
4. [Tier 3: Complex Form — ASCII Wireframe + Code](#tier-3-complex-form)
5. [Section Heading Pattern](#section-heading-pattern)
6. [Field Grid Rules](#field-grid-rules)
7. [Sticky Action Bar Pattern](#sticky-action-bar-pattern)
8. [Sidebar TOC Pattern (Tier 3 only)](#sidebar-toc-pattern)
9. [Unsaved Changes Indicator](#unsaved-changes-indicator)
10. [Anti-Patterns — What Claude Code Keeps Doing Wrong](#anti-patterns)

---

## The Three Tiers

```
How many fields does this form have?
  < 8 fields → Tier 1: Simple Form
  8–20 fields, 2–4 sections → Tier 2: Standard Form
  20+ fields, 5+ sections → Tier 3: Complex Form

Does this form have embedded tables (line items, SOV)?
  YES → Move up one tier minimum.
  Line items on a CREATE form? → Remove them. Tables belong on the detail/edit page.

Is this a creation form or an edit form?
  Creation: Show only essential fields. Defer optional fields to the detail page.
  Edit: Can show the full field set appropriate to its tier.
```

### Quick Reference

| Tier | Fields | Sections | Width | Layout | Sticky Bar |
|------|--------|----------|-------|--------|------------|
| 1 — Simple | < 8 | 0–1 | 672px (`FormContainer maxWidth="md"`) | Single column | Bottom border-t |
| 2 — Standard | 8–20 | 2–4 | 896px (`FormContainer maxWidth="lg"`) | 1–2 columns | Sticky bottom bar |
| 3 — Complex | 20+ | 5+ | 896px content + 192px sidebar | 2–3 columns + sidebar TOC | Sticky top bar |

---

## Tier 1: Simple Form

**Use for:** Change Events (create), basic settings, quick-entry forms

**Rule:** If a form has fewer than 8 fields and fits in a single logical group, use Tier 1. No sidebar. No sticky bar — a simple `border-t` actions row at the bottom is fine because the form is short enough to never require scrolling.

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  ProjectPageHeader                                                   │
│  New Change Event          [Cancel ←]                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│         ┌──────────────────────────────────────┐                    │
│         │  Title *                              │  672px max         │
│         │  ┌────────────────────────────────┐  │                    │
│         │  │                                │  │                    │
│         │  └────────────────────────────────┘  │                    │
│         │                                      │                    │
│         │  ┌─────────────────┐  ┌───────────┐  │                    │
│         │  │  Status         │  │ Origin    │  │                    │
│         │  │  [Draft     ▾]  │  │ [Owner ▾] │  │                    │
│         │  └─────────────────┘  └───────────┘  │                    │
│         │                                      │                    │
│         │  Description (optional)              │                    │
│         │  ┌────────────────────────────────┐  │                    │
│         │  │                                │  │                    │
│         │  │                                │  │                    │
│         │  └────────────────────────────────┘  │                    │
│         │                                      │                    │
│         │  ──────────────────────────────────  │                    │
│         │                [Cancel] [Create CE]  │                    │
│         └──────────────────────────────────────┘                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Full Page Template

```tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProjectPageHeader, PageContainer, FormContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.string().min(1, "Status is required"),
  origin: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewChangeEventPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      status: "open",
      origin: "",
      description: "",
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      // API call here
      toast.success("Change event created");
      router.push(`/${projectId}/change-events`);
    } catch {
      toast.error("Failed to create change event");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ProjectPageHeader
        title="New Change Event"
        description="Document a potential change to the project scope or cost"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
        }
      />
      <PageContainer>
        {/* Tier 1: FormContainer maxWidth="md" = 672px. No card wrapper. */}
        <FormContainer maxWidth="md" withCard={false}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Full-width field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of the change" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 2-column row for related short fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select origin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                          <SelectItem value="unforeseen">Unforeseen Condition</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Full-width textarea */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the nature and reason for this change..."
                        className="min-h-24 resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions — simple border-t at bottom for Tier 1 (form is short) */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Change Event
                </Button>
              </div>

            </form>
          </Form>
        </FormContainer>
      </PageContainer>
    </>
  );
}
```

---

## Tier 2: Standard Form

**Use for:** Change Orders (create/edit), Commitments (create/edit), Direct Costs (create/edit)

**Rule:** 8–20 fields across 2–4 logical sections. Uses `FormContainer maxWidth="lg"` (896px). Has a **sticky bottom action bar** — because the form is long enough that the user will scroll and should never lose sight of Save/Cancel.

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ProjectPageHeader                                                           │
│  New Change Order               [Cancel]  [Create Change Order]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│         ┌────────────────────────────────────────────────┐                  │
│         │  ── General Information ───────────────────── │  896px max        │
│         │                                               │                  │
│         │  ┌────────────────────────────────────────┐   │                  │
│         │  │  Title *                               │   │                  │
│         │  │  ┌──────────────────────────────────┐  │   │                  │
│         │  │  │                                  │  │   │                  │
│         │  │  └──────────────────────────────────┘  │   │                  │
│         │  └────────────────────────────────────────┘   │                  │
│         │                                               │                  │
│         │  ┌────────────────┐  ┌───────────────────┐    │                  │
│         │  │  CO Number *   │  │  Status           │    │                  │
│         │  │  [CO-001    ]  │  │  [Draft       ▾]  │    │                  │
│         │  └────────────────┘  └───────────────────┘    │                  │
│         │                                               │                  │
│         │  ┌─────────────────────────────────────────┐  │                  │
│         │  │  Contract                               │  │                  │
│         │  │  [Select contract...                ▾]  │  │                  │
│         │  └─────────────────────────────────────────┘  │                  │
│         │                                               │                  │
│         │  ── Dates & Schedule ──────────────────────── │                  │
│         │                                               │                  │
│         │  ┌──────────────────────┐  ┌───────────────┐  │                  │
│         │  │  Due Date            │  │  Executed     │  │                  │
│         │  │  [  /  /      ]      │  │  [  /  /    ] │  │                  │
│         │  └──────────────────────┘  └───────────────┘  │                  │
│         │                                               │                  │
│         │  ── Description ──────────────────────────── │                  │
│         │                                               │                  │
│         │  ┌─────────────────────────────────────────┐  │                  │
│         │  │                                         │  │                  │
│         │  │  [Textarea — 120px min-h]               │  │                  │
│         │  │                                         │  │                  │
│         │  └─────────────────────────────────────────┘  │                  │
│         │                                               │                  │
│         └────────────────────────────────────────────────┘                  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Sticky bottom bar  (position: sticky, bottom: 0, z-10)                     │
│  bg-background border-t border-border                                        │
│                              [Cancel]  [Create Change Order]                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Full Page Template

```tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProjectPageHeader, PageContainer, FormContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(1, "Title is required"),
  number: z.string().min(1, "Change Order number is required"),
  status: z.string(),
  contractId: z.string().optional(),
  dueDate: z.string().optional(),
  executedDate: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewChangeOrderPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      number: "",
      status: "draft",
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      // API call here
      toast.success("Change order created");
      router.push(`/${projectId}/change-orders`);
    } catch {
      toast.error("Failed to create change order");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCancel = () => router.push(`/${projectId}/change-orders`);

  return (
    <>
      <ProjectPageHeader
        title="New Change Order"
        description="Create a formal change order against an existing commitment"
      />

      {/* PageContainer: no bottom padding — sticky bar sits flush at viewport bottom */}
      <PageContainer className="pb-0">
        {/* Tier 2: FormContainer maxWidth="lg" = 896px. No card wrapper. */}
        <FormContainer maxWidth="lg" withCard={false}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8"
              id="change-order-form"
            >

              {/* ── Section 1: General Information ─────────────────────────── */}
              <section className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h2 className="text-base font-semibold text-foreground">General Information</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Basic details for this change order
                  </p>
                </div>

                {/* Title spans full width */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter change order title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Short paired fields: 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CO Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="CO-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            {/* w-full is MANDATORY on SelectTrigger — never let it auto-size */}
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Full-width select for related entity */}
                <FormField
                  control={form.control}
                  name="contractId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a contract" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Populated from API */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* ── Section 2: Dates & Schedule ────────────────────────────── */}
              <section className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h2 className="text-base font-semibold text-foreground">Dates</h2>
                </div>

                {/* Date pairs: 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="executedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Executed Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* ── Section 3: Description ──────────────────────────────────── */}
              <section className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h2 className="text-base font-semibold text-foreground">Description</h2>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        {/* min-h-24 = 96px. NEVER use a fixed height like h-36 = 144px wasteland */}
                        <Textarea
                          placeholder="Describe the scope and reason for this change order..."
                          className="min-h-24 resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* Spacer so content isn't hidden behind sticky bar */}
              <div className="h-20" />

            </form>
          </Form>
        </FormContainer>
      </PageContainer>

      {/* ── Sticky Bottom Action Bar — Tier 2 ────────────────────────────────── */}
      {/*
        CRITICAL: This sits OUTSIDE PageContainer and FormContainer.
        It must be outside the scroll area to stick properly.
      */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Left: unsaved indicator (shown when form is dirty) */}
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {form.formState.isDirty ? "Unsaved changes" : ""}
            </p>
            {/* Right: actions */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="change-order-form"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Change Order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## Tier 3: Complex Form

**Use for:** Prime Contracts (create/edit), Invoicing (create/edit)

**Rule:** 20+ fields across 5+ sections. Uses a **sidebar Table of Contents** for section navigation and a **sticky top action bar** (because the form body is so long, a bottom bar becomes unreachable until far too much scrolling occurs). The form content column is still 896px max — the sidebar adds to the right of it.

### CRITICAL RULE FOR TIER 3 CREATION FORMS

The following must NEVER appear on a creation form, regardless of tier:
- Schedule of Values / line item tables — add on the detail page
- Actual Completion Date — you can't know this on creation
- Contract Termination Date — add on edit when needed
- Advanced privacy controls — configure after creation

Keep creation forms to the essential fields only. The user can add everything else after the record exists.

### ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Sticky top action bar  (position: sticky, top: 0, z-20)                         │
│  bg-background/95 border-b border-border                                          │
│  ← New Prime Contract — Draft                    [Cancel] [Create Contract]      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │  FORM CONTENT  (896px max)                          │  │  SIDEBAR TOC     │  │
│  │                                                     │  │  (192px fixed)   │  │
│  │  ── General Information ─────────────────────────   │  │                  │  │
│  │                                                     │  │  SECTIONS        │  │
│  │  Contract #     Title                               │  │  ──────────      │  │
│  │  [CO-001   ]    [                              ]    │  │  • General Info  │  │
│  │                                                     │  │  • Parties       │  │
│  │  Status         Executed                            │  │  • Dates         │  │
│  │  [Draft  ▾]    [ ] Yes                              │  │  • Payment       │  │
│  │                                                     │  │  • Description   │  │
│  │  ── Parties ─────────────────────────────────────   │  │  • Privacy       │  │
│  │                                                     │  │                  │  │
│  │  Owner Company              Contractor              │  │                  │  │
│  │  [Select...            ▾]  [Select...          ▾]  │  │                  │  │
│  │                                                     │  │                  │  │
│  │  Architect/Engineer                                 │  │                  │  │
│  │  [Select...                                   ▾]   │  │                  │  │
│  │                                                     │  │                  │  │
│  │  ── Contract Dates ──────────────────────────────   │  │                  │  │
│  │                                                     │  │                  │  │
│  │  Start Date      Est. Completion   Sub. Completion  │  │                  │  │
│  │  [  /  /   ]     [  /  /   ]       [  /  /   ]     │  │                  │  │
│  │                                                     │  │                  │  │
│  │  Signed Contract Received                           │  │                  │  │
│  │  [  /  /   ]                                        │  │                  │  │
│  │                                                     │  │                  │  │
│  │  ── Payment Terms ───────────────────────────────   │  │                  │  │
│  │                                                     │  │                  │  │
│  │  Payment Terms              Default Retainage       │  │                  │  │
│  │  [Net 30            ▾]     [10            %]        │  │                  │  │
│  │                                                     │  │                  │  │
│  │  Billing Schedule                                   │  │                  │  │
│  │  [Monthly           ▾]                              │  │                  │  │
│  │                                                     │  │                  │  │
│  │  ── Description ─────────────────────────────────   │  │                  │  │
│  │                                                     │  │                  │  │
│  │  [Textarea min-h-32]                                │  │                  │  │
│  │                                                     │  │                  │  │
│  │  ── Contract Privacy ────────────────────────────   │  │                  │  │
│  │                                                     │  │                  │  │
│  │  [ ] Mark this contract as private                  │  │                  │  │
│  │                                                     │  │                  │  │
│  └─────────────────────────────────────────────────────┘  └──────────────────┘  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Full Page Template

```tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProjectPageHeader, PageContainer, FormContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  number: z.string().min(1, "Contract number is required"),
  title: z.string().min(1, "Title is required"),
  status: z.string(),
  executed: z.boolean().default(false),
  ownerCompanyId: z.string().optional(),
  contractorId: z.string().optional(),
  architectEngineerId: z.string().optional(),
  startDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  substantialCompletionDate: z.string().optional(),
  signedContractReceivedDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  billingSchedule: z.string().optional(),
  defaultRetainage: z.number().min(0).max(100).default(10),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

// ── Section IDs for TOC scrolling ─────────────────────────────────────────────
const SECTIONS = [
  { id: "general-info",    label: "General Info" },
  { id: "parties",         label: "Parties" },
  { id: "contract-dates",  label: "Dates" },
  { id: "payment-terms",   label: "Payment Terms" },
  { id: "description",     label: "Description" },
  { id: "privacy",         label: "Privacy" },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewPrimeContractPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string>("general-info");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: "",
      title: "",
      status: "draft",
      executed: false,
      defaultRetainage: 10,
      isPrivate: false,
    },
  });

  // Scrollspy — update active section as user scrolls
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  // Smooth-scroll to section when TOC item is clicked
  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      // Offset 72px for the sticky top bar
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      // API call here
      toast.success("Prime contract created");
      router.push(`/${projectId}/prime-contracts`);
    } catch {
      toast.error("Failed to create contract");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCancel = () => router.push(`/${projectId}/prime-contracts`);
  const isDirty = form.formState.isDirty;

  return (
    <>
      {/*
        Tier 3 uses a STICKY TOP BAR instead of the standard ProjectPageHeader.
        This replaces the header for the form context only.
        The ProjectPageHeader has no sticky behavior — it scrolls away.
        The sticky bar keeps Save/Cancel visible from line 1.
      */}

      {/* ── Sticky Top Action Bar — Tier 3 ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          {/* Left: context */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              ← Prime Contracts
            </button>
            <span className="text-muted-foreground/40 flex-shrink-0">/</span>
            <span className="text-sm font-medium text-foreground truncate">
              New Prime Contract
            </span>
            {isDirty && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                — Unsaved changes
              </span>
            )}
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              form="prime-contract-form"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Contract
            </Button>
          </div>
        </div>
      </div>

      {/* ── Page Body ──────────────────────────────────────────────────────── */}
      <PageContainer>
        {/*
          Tier 3 layout: 2-column grid.
          Left: FormContainer (896px content)
          Right: Sidebar TOC (192px fixed, sticky)
          Gap must be gap-12 minimum — gap-6 or gap-8 is too cramped.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_192px] gap-12 items-start">

          {/* ── Form Content Column ─────────────────────────────────────────── */}
          <FormContainer maxWidth="lg" withCard={false} padding={false}>
            <Form {...form}>
              <form
                id="prime-contract-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-10"
              >

                {/* ── Section 1: General Information ───────────────────────── */}
                <section id="general-info" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">
                      General Information
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Core contract identifiers and status
                    </p>
                  </div>

                  {/*
                    Field sizing rule:
                    - Contract #: short (max-w for number-like field)
                    - Title: full width (spans the remaining space)
                    Solution: named column grid
                  */}
                  <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-6">
                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract # <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="PC-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Enter contract title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="out_for_bid">Out for Bid</SelectItem>
                              <SelectItem value="out_for_signature">Out for Signature</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="executed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Executed</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2 h-9 mt-0.5">
                              <Checkbox
                                id="executed"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label
                                htmlFor="executed"
                                className="text-sm text-muted-foreground cursor-pointer select-none"
                              >
                                Contract has been executed
                              </label>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {/* ── Section 2: Parties ───────────────────────────────────── */}
                <section id="parties" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">Parties</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Companies and individuals party to this contract
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="ownerCompanyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner / Client</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Populated from API */}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contractorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contractor</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select contractor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Populated from API */}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="architectEngineerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Architect / Engineer</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select firm (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {/* Populated from API */}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                {/* ── Section 3: Contract Dates ────────────────────────────── */}
                <section id="contract-dates" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">Contract Dates</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Key milestones and schedule dates
                    </p>
                  </div>

                  {/*
                    Tier 3 allows 3-column grids for short fields like dates.
                    3 columns only when all 3 fields are clearly related and equally short.
                  */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estimatedCompletionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Est. Completion</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="substantialCompletionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Substantial Completion</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/*
                    Signed Contract Received: a single date that doesn't pair naturally
                    with the milestone dates above. Give it its own row, constrained width.
                  */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="signedContractReceivedDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Signed Contract Received</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Second column empty — preserves visual balance */}
                  </div>
                </section>

                {/* ── Section 4: Payment Terms ──────────────────────────────── */}
                <section id="payment-terms" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">Payment Terms</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="paymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select terms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="net_30">Net 30</SelectItem>
                              <SelectItem value="net_45">Net 45</SelectItem>
                              <SelectItem value="net_60">Net 60</SelectItem>
                              <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="billingSchedule"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Schedule</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select schedule" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="milestone">Milestone-Based</SelectItem>
                              <SelectItem value="percent_complete">Percent Complete</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultRetainage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Retainage (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="10"
                                className="pr-8"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {/* ── Section 5: Description ────────────────────────────────── */}
                <section id="description" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">Description</h2>
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Description{" "}
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          {/* min-h-32 = 128px. Reasonable for description, not a wasteland. */}
                          <Textarea
                            placeholder="Describe the scope and terms of this contract..."
                            className="min-h-32 resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                {/* ── Section 6: Privacy ───────────────────────────────────── */}
                <section id="privacy" className="space-y-6 scroll-mt-20">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-semibold text-foreground">Privacy</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Control who can view this contract
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              id="isPrivate"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div>
                            <label
                              htmlFor="isPrivate"
                              className="text-sm font-medium text-foreground cursor-pointer"
                            >
                              Mark as private
                            </label>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Only users you explicitly grant access can view this contract
                            </p>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                {/* Bottom spacer so content doesn't hide under sticky elements */}
                <div className="h-8" />

              </form>
            </Form>
          </FormContainer>

          {/* ── Sidebar TOC Column ───────────────────────────────────────────── */}
          {/*
            sticky top-[72px]: positions below the sticky action bar (approx 72px tall).
            hidden lg:block: TOC is desktop-only. Mobile relies on natural scroll.
          */}
          <aside className="hidden lg:block sticky top-[72px] self-start">
            <nav aria-label="Form sections">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Sections
              </p>
              <div className="space-y-0.5">
                {SECTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className={[
                      "w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                      activeSection === id
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </nav>
          </aside>

        </div>
      </PageContainer>
    </>
  );
}
```

---

## Section Heading Pattern

Every section in every form uses one of two heading treatments. Never invent your own.

### Standard Section Heading (Tiers 1, 2, 3)

```tsx
{/* Use this for all sections */}
<div className="border-b border-border pb-3">
  <h2 className="text-base font-semibold text-foreground">Section Title</h2>
  <p className="mt-0.5 text-sm text-muted-foreground">
    Optional one-line description of what this section contains
  </p>
</div>
```

**Rules:**
- `text-base font-semibold` — not `text-lg`. Section headings are subordinate to the page title.
- `border-b border-border pb-3` — the only visual separator between section heading and fields.
- `text-muted-foreground` description — present only when the section name alone is ambiguous.
- Sections separated by `space-y-8` or `space-y-10` on the parent `<form>` — never use `<hr>` or `<Separator>` between sections.

### What NOT to use

```tsx
{/* WRONG: Too large — competes with page title */}
<h2 className="text-lg font-semibold">Section</h2>

{/* WRONG: Card wrapping a section — this is the Card Trap */}
<Card>
  <CardHeader><CardTitle>Section</CardTitle></CardHeader>
  <CardContent>...</CardContent>
</Card>

{/* WRONG: Eyebrow-only (no separator) — too subtle, sections blur together */}
<p className="text-[11px] font-semibold uppercase tracking-wider">SECTION</p>

{/* WRONG: Heavy separator — too visually aggressive */}
<div className="border-t-2 border-primary pt-4">
  <h2>Section</h2>
</div>
```

---

## Field Grid Rules

These rules are absolute. Never deviate without a documented reason.

### Rule 1: Always match SelectTrigger width to its grid column

```tsx
{/* CORRECT — SelectTrigger fills its grid column */}
<SelectTrigger className="w-full">

{/* WRONG — auto-width SelectTrigger that shrinks to content */}
<SelectTrigger>
```

This is the single most common form bug in this codebase. Every `SelectTrigger` must have `className="w-full"`.

### Rule 2: Field column assignment

| Field type | Column assignment |
|------------|-------------------|
| Title | Full width (1 column spanning all) |
| Description / Textarea | Full width |
| Rich text editor | Full width. Min-height 128px. Never 150px+ on a create form. |
| Contract # / Record # | Named-column grid: `grid-cols-[180px_minmax(0,1fr)]` |
| Status + Priority | 2-column: `grid-cols-2` |
| Amount + Currency | 2-column: `grid-cols-2` |
| Date fields (related set) | 3-column on Tier 3: `grid-cols-3`. 2-column on Tier 2. |
| Single date | 2-column, occupies 1 column (second column is empty or another field) |
| Checkbox + label | Full width, inline flex layout (see Privacy section example) |

### Rule 3: Responsive breakpoints for all grids

```tsx
{/* 2-column grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

{/* 3-column grid (Tier 3 only) */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

{/* Named column (number + title): NO responsive fallback — number field is short enough */}
<div className="grid grid-cols-[180px_minmax(0,1fr)] gap-6">
```

### Rule 4: Gap is always gap-6

Form fields within a grid always use `gap-6` (24px). Never `gap-4` (too tight) or `gap-8` (too loose). The only exception is when two fields are semantically bound (start date + end date as a date range), where `gap-4` is acceptable.

### Rule 5: Textarea min-height

| Context | Class |
|---------|-------|
| Short optional description on Tier 1 | `min-h-24` (96px) |
| Standard description on Tier 2/3 | `min-h-32` (128px) |
| Never use | `h-36`, `h-40`, `min-h-[150px]` — these create wasteland on create forms |

All textareas must have `resize-y` to let the user expand if needed.

---

## Sticky Action Bar Pattern

### When to use which pattern

| Tier | Form length | Action bar type |
|------|-------------|-----------------|
| Tier 1 | Short (no scroll) | `border-t` at bottom of form |
| Tier 2 | Medium scroll | Sticky bottom bar |
| Tier 3 | Long scroll | Sticky top bar |

### Tier 1: Bottom border (no sticky needed)

```tsx
{/* Inside the form, as the last element */}
<div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
  <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
    Cancel
  </Button>
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
    Create Change Event
  </Button>
</div>
```

### Tier 2: Sticky bottom bar

```tsx
{/*
  Outside PageContainer entirely. Position fixed to viewport bottom.
  form="form-id" attribute connects button to form without nesting.
*/}
<div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
  <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between py-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {form.formState.isDirty ? "Unsaved changes" : ""}
      </p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="my-form-id" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Change Order
        </Button>
      </div>
    </div>
  </div>
</div>
```

### Tier 3: Sticky top bar

```tsx
{/*
  Replaces the ProjectPageHeader context for complex form pages.
  Must be placed BEFORE PageContainer in JSX so it appears above the content.
*/}
<div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
  <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={handleCancel}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        ← Prime Contracts
      </button>
      <span className="text-muted-foreground/40">/</span>
      <span className="text-sm font-medium text-foreground truncate">
        New Prime Contract
      </span>
      {isDirty && (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          — Unsaved changes
        </span>
      )}
    </div>
    <div className="flex items-center gap-3 flex-shrink-0">
      <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" size="sm" form="my-form-id" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create Contract
      </Button>
    </div>
  </div>
</div>
```

### Button label convention

| Context | Cancel label | Submit label |
|---------|-------------|--------------|
| Create form | Cancel | Create [Entity] |
| Edit form | Cancel | Save Changes |
| Both labels must | Be consistent | Across ALL forms |

Never use: "Submit", "OK", "Save", "Done" (without "Changes"). Always say exactly what the action does.

---

## Sidebar TOC Pattern

The TOC sidebar is for **Tier 3 forms only**. Do not add it to Tier 1 or Tier 2.

### Full TOC component (copy-paste)

```tsx
// ── Constants ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "section-id-1", label: "Display Label 1" },
  { id: "section-id-2", label: "Display Label 2" },
  // ...
] as const;

// ── Scrollspy hook ────────────────────────────────────────────────────────────
function useScrollspy(sectionIds: readonly string[], offset = 72) {
  const [activeId, setActiveId] = React.useState<string>(sectionIds[0]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      // rootMargin: top = offset, bottom = narrow window so early sections don't
      // "un-activate" the moment you scroll past them
      { rootMargin: `-${offset}px 0px -70% 0px`, threshold: 0 }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds, offset]);

  return activeId;
}

// ── Scroll-to helper ──────────────────────────────────────────────────────────
function scrollToSection(id: string, offset = 80) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

// ── TOC Component ─────────────────────────────────────────────────────────────
function FormSidebarToc({
  sections,
  activeId,
  onNavigate,
}: {
  sections: readonly { id: string; label: string }[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <aside className="hidden lg:block sticky top-[72px] self-start">
      <nav aria-label="Form sections">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Sections
        </p>
        <div className="space-y-0.5">
          {sections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={[
                "w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                activeId === id
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
}

// ── Usage in page ─────────────────────────────────────────────────────────────
const SECTION_IDS = SECTIONS.map((s) => s.id) as string[];
const activeSection = useScrollspy(SECTION_IDS);

// In JSX:
<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_192px] gap-12 items-start">
  <FormContainer maxWidth="lg" withCard={false} padding={false}>
    {/* form content */}
  </FormContainer>

  <FormSidebarToc
    sections={SECTIONS}
    activeId={activeSection}
    onNavigate={scrollToSection}
  />
</div>
```

### TOC section link requirements

Every section that appears in the TOC must have:
1. A matching `id` attribute: `<section id="general-info">`
2. `scroll-mt-20` on the section element (prevents sticky bar from covering the heading)
3. A unique, human-readable ID (no generic `section-1`)

---

## Unsaved Changes Indicator

Always show when the form has been modified and not saved. Never leave the user wondering if their work is saved.

```tsx
// React Hook Form provides this automatically:
const isDirty = form.formState.isDirty;

// Tier 1: Display nowhere (form is short, user can see they've typed)

// Tier 2: In the sticky bottom bar
<p className="text-sm text-muted-foreground" aria-live="polite">
  {isDirty ? "Unsaved changes" : ""}
</p>

// Tier 3: In the sticky top bar, inline with breadcrumb
{isDirty && (
  <span className="text-xs text-muted-foreground flex-shrink-0">
    — Unsaved changes
  </span>
)}
```

**Never** use a modal to warn about unsaved changes on navigation. The indicator in the bar is sufficient.

---

## Anti-Patterns

This section documents every mistake that has been made in this codebase. Read before writing any form code. If your code matches any of these patterns, fix it before committing.

### AP-1: Tables on creation forms

```tsx
{/* WRONG — Schedule of Values table embedded in /new form */}
<section>
  <h2>Schedule of Values</h2>
  <SOVTable items={sovItems} />
  <Button onClick={addLine}>Add Line</Button>
  <Button onClick={addAnotherLine}>Add Line Item</Button> {/* Two "Add" buttons */}
</section>

{/* CORRECT — SOV lives on the detail/edit page, not creation */}
{/* On /new page: show nothing */}
{/* On /[id]/edit or /[id] page: show the SOV table in a dedicated tab */}
```

**Rule:** Line item tables, SOV, cost codes — all added after the record is created. Never in a creation form. This is the #1 reason Prime Contracts new page is 4 scrolls long.

### AP-2: Uncontrolled SelectTrigger width

```tsx
{/* WRONG — SelectTrigger shrinks to content, looks broken */}
<SelectTrigger>
  <SelectValue placeholder="Status" />
</SelectTrigger>

{/* CORRECT */}
<SelectTrigger className="w-full">
  <SelectValue placeholder="Status" />
</SelectTrigger>
```

### AP-3: Card wrapper for form sections

```tsx
{/* WRONG — Card inside FormContainer, inside PageContainer */}
<Card>
  <CardHeader>
    <CardTitle>General Information</CardTitle>
  </CardHeader>
  <CardContent>
    {/* fields */}
  </CardContent>
</Card>

{/* CORRECT — section with border-b heading, no card */}
<section className="space-y-6">
  <div className="border-b border-border pb-3">
    <h2 className="text-base font-semibold text-foreground">General Information</h2>
  </div>
  {/* fields */}
</section>
```

Forms are NOT content pages. Cards inside forms create "cards inside cards" — a banned pattern.

### AP-4: FormContainer maxWidth overridden with arbitrary max-w

```tsx
{/* WRONG — bypasses the design system, creates 1400px form wasteland */}
<FormContainer maxWidth="xl" className="max-w-[1400px]">

{/* CORRECT — use the appropriate tier */}
{/* Tier 2 or 3: */}
<FormContainer maxWidth="lg">
```

### AP-5: Overriding PageContainer with bg-muted/30

```tsx
{/* WRONG — creates a grey box around the form, looks like a modal */}
<PageContainer className="bg-muted/30">
  <FormContainer>

{/* CORRECT — PageContainer gets no background override */}
<PageContainer>
  <FormContainer>
```

### AP-6: Massive textarea height on creation forms

```tsx
{/* WRONG — 150px empty white on a creation form */}
<Textarea className="h-36" />

{/* WRONG — fixed height that doesn't grow */}
<Textarea className="h-24" />

{/* CORRECT — min-height with resize */}
<Textarea className="min-h-24 resize-y" />  {/* Tier 1 */}
<Textarea className="min-h-32 resize-y" />  {/* Tier 2/3 */}
```

### AP-7: 6-date flat grid with no hierarchy

```tsx
{/* WRONG — 3x2 flat grid treats Actual Completion same as Start Date */}
<div className="grid grid-cols-3 gap-6">
  <DateField name="startDate" />
  <DateField name="estimatedCompletionDate" />
  <DateField name="substantialCompletionDate" />
  <DateField name="actualCompletionDate" />
  <DateField name="signedContractReceivedDate" />
  <DateField name="contractTerminationDate" />
</div>

{/* CORRECT — group by logical meaning, defer "actual" dates to edit form */}
{/* Creation form: only forward-looking dates */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <DateField name="startDate" />
  <DateField name="estimatedCompletionDate" />
  <DateField name="substantialCompletionDate" />
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
  <DateField name="signedContractReceivedDate" />
</div>

{/* Actual Completion + Contract Termination: edit form only */}
```

### AP-8: Actions in both header and footer (duplicate buttons)

```tsx
{/* WRONG — Save button in ProjectPageHeader AND at bottom of form */}
<ProjectPageHeader
  actions={<Button>Create Contract</Button>}  {/* Remove this */}
/>
{/* ... form ... */}
<div className="flex justify-end">
  <Button>Create Contract</Button>  {/* Keep only this (or sticky bar) */}
</div>
```

One action bar. One place. Either the sticky bar (Tier 2/3) or the bottom `border-t` row (Tier 1).

### AP-9: Emoji in empty states

```tsx
{/* WRONG */}
<p>No items added yet</p>

{/* CORRECT */}
<EmptyState
  icon={PlusCircle}
  title="No line items yet"
  description="Add line items after saving this contract"
/>
```

### AP-10: Form width using maxWidth="full" or PageContainer default

```tsx
{/* WRONG — form stretches to full viewport */}
<PageContainer maxWidth="full">
  <ContractForm />
</PageContainer>

{/* CORRECT — always use FormContainer for forms */}
<PageContainer>
  <FormContainer maxWidth="lg">
    <ContractForm />
  </FormContainer>
</PageContainer>
```

### AP-11: Left-aligned submit buttons

```tsx
{/* WRONG */}
<div className="flex gap-4">
  <Button type="submit">Save</Button>
  <Button variant="outline" onClick={cancel}>Cancel</Button>
</div>

{/* CORRECT — actions always right-aligned, Cancel left of Submit */}
<div className="flex items-center justify-end gap-3">
  <Button variant="outline" onClick={cancel}>Cancel</Button>
  <Button type="submit">Save Changes</Button>
</div>
```

### AP-12: Hardcoded colors or shadows

```tsx
{/* WRONG */}
<div className="bg-white border-gray-200 shadow-md">
<div className="bg-orange-50 border-orange-200">

{/* CORRECT */}
<div className="bg-card border-border shadow-sm">
<div className="bg-primary/5 border-primary/20">
```

### AP-13: Missing `form="id"` connection for external submit buttons

```tsx
{/* WRONG — sticky bar button can't submit the form because form is in PageContainer */}
<Button type="submit">Save</Button>

{/* CORRECT — always connect external buttons to their form via form attribute */}
<form id="my-form-id" onSubmit={handleSubmit(onSubmit)}>
  {/* ... */}
</form>

{/* Elsewhere in JSX: */}
<Button type="submit" form="my-form-id">Save</Button>
```

---

## Quick Tier Decision

```
Is this a CREATION form for an entity with < 8 required fields?
  → Tier 1. FormContainer maxWidth="md". Border-t actions at bottom.

Is this a CREATION form with 8–20 fields and 2–4 sections?
  → Tier 2. FormContainer maxWidth="lg". Sticky bottom bar.

Is this a CREATION form with 20+ fields and 5+ sections?
  → Tier 3. FormContainer maxWidth="lg" + sidebar TOC. Sticky top bar.
  → Remove ALL tables. Remove ALL "actual" date fields. Defer to detail page.

Is this an EDIT form?
  → Match the tier of the entity's creation form.
  → Edit forms MAY add read-only audit fields (Actual Completion, etc.)
  → Edit forms MAY reference line items in a separate tab (not in the form body).
```

---

*Last updated: 2026-03. Maintained by: Design System.*
