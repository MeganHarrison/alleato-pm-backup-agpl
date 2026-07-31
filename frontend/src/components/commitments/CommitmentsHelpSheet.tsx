"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { getAppHelpArticleUrl } from "@/features/knowledge/app-help-content";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";

const commitmentsGuideUrl = getAppHelpArticleUrl("commitments");
const commitmentsReferenceUrl = getAppHelpArticleUrl("commitments-reference");

interface CommitmentsHelpSheetProps {
  buttonLabel?: string;
  buttonVariant?: "ghost" | "outline" | "secondary";
  className?: string;
}

export function CommitmentsHelpSheet({
  buttonLabel = "Open commitments help",
  buttonVariant = "ghost",
  className,
}: CommitmentsHelpSheetProps) {
  return (
    <SidePanel>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          size="icon"
          className={className}
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SidePanelContent side="right" size="lg">
        <SidePanelHeader className="px-6 py-5">
          <SidePanelTitle>Commitments</SidePanelTitle>
          <SheetDescription>
            Subcontracts, purchase orders, commitment change orders, invoices, and schedule-of-values rules.
          </SheetDescription>
        </SidePanelHeader>

        <SidePanelBody className="space-y-8 px-6 py-6 text-sm">
          <section className="space-y-3">
            <SectionRuleHeading label="What belongs here" className="pb-0" />
            <ul className="space-y-2 text-muted-foreground">
              <li>Subcontracts and purchase orders are the base commitment records.</li>
              <li>Schedule of Values drives commitment value, billing, and invoice rollups.</li>
              <li>Commitment change orders carry downstream value changes tied to the commitment.</li>
              <li>Invoices and payments read against the commitment and its current approved value.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionRuleHeading label="Typical workflow" className="pb-0" />
            <ol className="space-y-2 text-muted-foreground">
              <li>1. Create the commitment and confirm vendor, amount, and accounting method.</li>
              <li>2. Build the SOV before invoice activity starts.</li>
              <li>3. Use commitment change orders for formal scope or value changes.</li>
              <li>4. Submit invoices only after the commitment value and approved changes are correct.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <SectionRuleHeading label="Lock rules" className="pb-0" />
            <ul className="space-y-2 text-muted-foreground">
              <li>Commitment change-order line items lock while the change order status is Approved.</li>
              <li>You can still change a commitment change-order status back to Draft, which unlocks its line items again.</li>
              <li>Commitment SOV lines stay editable until the first invoice has entered submitted workflow.</li>
              <li>After invoice submission starts, the commitment SOV stays locked to protect invoice history and totals.</li>
              <li>Individual SOV rows with billed dollars already on them cannot have their billed amount history rewritten.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <SectionRuleHeading label="Where to go next" className="pb-0" />
            <ul className="space-y-2 text-muted-foreground">
              <li>Use the commitment detail page to manage the base record, SOV, invoices, and related items.</li>
              <li>Use the Change Orders tab or commitment change-order pages for formal commitment adjustments.</li>
              <li>Use the invoice tab when pay applications have started and the commitment value should not move anymore.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <SectionRuleHeading label="Reference articles" className="pb-0" />
            <div className="space-y-2">
              <Link
                href={commitmentsGuideUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-primary hover:underline"
              >
                Commitments guide
              </Link>
              <Link
                href={commitmentsReferenceUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-primary hover:underline"
              >
                Commitments reference
              </Link>
            </div>
          </section>
        </SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  );
}
