"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
} from "@/components/ds";
import {
  CreditCard,
  HelpCircle,
  Lock,
  Settings,
  Shield,
  Zap,
} from "lucide-react";

export function AccordionsSection() {
  return (
    <section id="accordions" className="scroll-mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">
          12
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Accordions
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Collapsible sections for FAQs, settings, and detail panels. Single
            and multi-open variants.
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Basic FAQ Style */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            FAQ / Single Open
          </h3>
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <Accordion type="single" collapsible className="px-1">
              <AccordionItem value="q1">
                <AccordionTrigger className="px-5 text-[13px] font-medium hover:no-underline">
                  How is budget variance calculated?
                </AccordionTrigger>
                <AccordionContent className="px-5 text-[13px] text-muted-foreground leading-relaxed">
                  Budget variance is the difference between your approved budget
                  and the sum of all committed costs and direct expenses. A
                  negative variance indicates overrun.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger className="px-5 text-[13px] font-medium hover:no-underline">
                  What counts as a direct cost?
                </AccordionTrigger>
                <AccordionContent className="px-5 text-[13px] text-muted-foreground leading-relaxed">
                  Direct costs are expenses tied to a specific cost code without
                  a formal contract — materials, labor, equipment, and
                  miscellaneous site expenses logged per line item.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger className="px-5 text-[13px] font-medium hover:no-underline">
                  Can I import line items from CSV?
                </AccordionTrigger>
                <AccordionContent className="px-5 text-[13px] text-muted-foreground leading-relaxed">
                  Yes. Use the Import button on any budget or direct costs page.
                  Download the template first to ensure your columns match the
                  required format.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger className="px-5 text-[13px] font-medium hover:no-underline">
                  How do change orders affect commitments?
                </AccordionTrigger>
                <AccordionContent className="px-5 text-[13px] text-muted-foreground leading-relaxed">
                  Approved change orders automatically update the commitment
                  value and recalculate all downstream budget roll-ups in
                  real time.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Settings / Multi Open with Icons */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Settings / Multi Open + Icons
          </h3>
          <div className="rounded-xl bg-card shadow-sm overflow-hidden">
            <Accordion type="multiple" className="px-1">
              <AccordionItem value="security">
                <AccordionTrigger className="px-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[13px] font-medium">
                      Security & Privacy
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          Two-factor auth
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Require 2FA on login
                        </p>
                      </div>
                      <Badge variant="active">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          Session timeout
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Auto-logout after inactivity
                        </p>
                      </div>
                      <span className="text-[12px] text-muted-foreground">
                        30 min
                      </span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="billing">
                <AccordionTrigger className="px-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[13px] font-medium">
                      Billing & Plan
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          Current plan
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Renews Jan 1, 2026
                        </p>
                      </div>
                      <Badge variant="default">Pro</Badge>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="integrations">
                <AccordionTrigger className="px-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[13px] font-medium">
                      Integrations
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          Procore sync
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Bi-directional data sync
                        </p>
                      </div>
                      <Badge variant="active">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          QuickBooks
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Accounting export
                        </p>
                      </div>
                      <Badge variant="inactive">Disconnected</Badge>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="advanced">
                <AccordionTrigger className="px-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <Settings className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-[13px] font-medium">
                      Advanced
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">
                          API access
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Manage API keys
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
