"use client";

import * as React from "react";
import Image from "next/image";
import {
  Building2,
  Upload,
  CreditCard,
  Users2,
  MapPin,
  CalendarDays,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { SectionRuleHeading } from "@/components/layout/spacing";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <SectionRuleHeading label={title} />
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    setLogoUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await apiFetch<{ logoUrl: string }>("/api/company/logo", {
        method: "POST",
        body: formData,
      });

      setLogoUrl(data.logoUrl);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
      // Reset input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <PageShell variant="dashboard" title="Account">
    <div className="px-8 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Company Profile */}
        <SectionCard icon={Building2} title="Company Profile">
          <div className="rounded-lg border border-border px-5 divide-y divide-border">
            {/* Logo */}
            <div className="py-4">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {logoUrl ? (
                    <>
                      <Image
                        src={logoUrl}
                        alt="Company logo"
                        fill
                        className="object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Remove logo"
                        onClick={() => setLogoUrl(null)}
                        className="absolute -top-0.5 -right-0.5 z-10 rounded-full h-5 w-5 p-0.5 shadow-sm hover:bg-muted transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </>
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Company logo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PNG, SVG, or WEBP. Max 2 MB. Recommended 256 × 256 px.
                  </p>
                  {logoError && (
                    <p className="text-xs text-destructive mt-1">{logoError}</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  aria-label="Upload company logo"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={logoUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  {logoUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>

            {/* Name & Industry */}
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-sm font-medium">
                    Company name
                  </Label>
                  <Input id="company-name" defaultValue="Alleato Group LLC" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry" className="text-sm font-medium">
                    Industry
                  </Label>
                  <Select defaultValue="commercial">
                    <SelectTrigger id="industry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commercial">
                        Commercial Construction
                      </SelectItem>
                      <SelectItem value="residential">
                        Residential Construction
                      </SelectItem>
                      <SelectItem value="industrial">
                        Industrial Construction
                      </SelectItem>
                      <SelectItem value="infrastructure">
                        Infrastructure
                      </SelectItem>
                      <SelectItem value="specialty">
                        Specialty Contractor
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-sm font-medium">
                    Website
                  </Label>
                  <Input
                    id="website"
                    defaultValue="https://alleatogroup.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone
                  </Label>
                  <Input id="phone" defaultValue="(615) 555-0100" />
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <Separator />

        {/* Address */}
        <SectionCard icon={MapPin} title="Address">
          <div className="rounded-lg border border-border px-5 divide-y divide-border">
            <div className="py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm font-medium">
                  Street address
                </Label>
                <Input
                  id="address"
                  defaultValue="1234 Commerce Dr, Suite 300"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input id="city" defaultValue="Nashville" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state" className="text-sm font-medium">
                    State
                  </Label>
                  <Input id="state" defaultValue="TN" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zip" className="text-sm font-medium">
                    ZIP code
                  </Label>
                  <Input id="zip" defaultValue="37201" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button size="sm">Save changes</Button>
          </div>
        </SectionCard>

        <Separator />

        {/* Plan & Billing */}
        <SectionCard icon={CreditCard} title="Plan & Billing">
          <div className="rounded-lg border border-border px-5 divide-y divide-border">
            {/* Plan */}
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Professional</span>
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                    Active
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  $299 / month · billed monthly
                </p>
              </div>
              <Button variant="outline" size="sm">
                Manage plan
              </Button>
            </div>

            {/* Seats */}
            <div className="py-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users2 className="h-3.5 w-3.5" />
                  Seats
                </span>
                <span className="font-medium tabular-nums">12 / 25 used</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: "48%" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                13 seats remaining. Upgrade to add more.
              </p>
            </div>

            {/* Renewal */}
            <div className="flex items-center justify-between py-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Next renewal
              </span>
              <span className="font-medium">April 1, 2026</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
    </PageShell>
  );
}
