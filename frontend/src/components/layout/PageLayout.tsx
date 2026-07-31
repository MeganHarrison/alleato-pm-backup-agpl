/**
 * @deprecated PageLayout is deprecated. Use PageShell from "@/components/layout" instead.
 * This file is kept to avoid breaking imports from files that haven't been migrated yet.
 * Use: <PageShell variant="content" title="..."> for content pages.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PageContainer, type PageContainerProps } from "./PageContainer";
import { PageHeader } from "./page-header-unified";

interface PageLayoutProps {
  // PageHeader props
  title: string;
  description?: string;
  actions?: React.ReactNode;

  // PageContainer props
  maxWidth?: PageContainerProps["maxWidth"];
  className?: string;
  containerClassName?: string;

  children: React.ReactNode;
}

/** @deprecated Use PageShell instead */
export function PageLayout({
  title,
  description,
  actions,
  maxWidth,
  className,
  containerClassName,
  children,
}: PageLayoutProps) {
  return (
    <PageContainer
      maxWidth={maxWidth}
      className={cn("flex flex-col", containerClassName)}
    >
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        className={className}
      />
      {children}
    </PageContainer>
  );
}
