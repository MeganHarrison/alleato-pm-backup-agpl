"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";

interface FormSheetProps extends React.ComponentProps<typeof SidePanel> {
  title: React.ReactNode;
  description?: React.ReactNode;
  formId: string;
  children: React.ReactNode;
  submitLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onCancel?: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  size?: React.ComponentProps<typeof SidePanelContent>["size"];
}

export function FormSheet({
  title,
  description,
  formId,
  children,
  submitLabel,
  cancelLabel = "Cancel",
  onCancel,
  submitting = false,
  submitDisabled = false,
  contentClassName,
  bodyClassName,
  footerClassName,
  size = "md",
  ...sheetProps
}: FormSheetProps) {
  return (
    <SidePanel {...sheetProps}>
      <SidePanelContent size={size} className={contentClassName}>
        <SidePanelHeader>
          <SidePanelTitle>{title}</SidePanelTitle>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </SidePanelHeader>

        <SidePanelBody className={bodyClassName}>{children}</SidePanelBody>

        <SidePanelFooter
          className={cn(
            "border-t border-border/60 bg-background",
            footerClassName,
          )}
        >
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="submit"
            form={formId}
            disabled={submitDisabled || submitting}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  );
}
