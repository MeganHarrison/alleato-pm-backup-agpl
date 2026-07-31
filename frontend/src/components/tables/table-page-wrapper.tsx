import { PageHeader } from "@/components/layout";
import { PageContainer } from "@/components/layout/PageContainer";

interface TablePageWrapperProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wrapper component for all table pages
 * Provides consistent PageHeader + PageContainer layout
 * Pages just pass title, description, and their table content
 */
export function TablePageWrapper({
  title,
  description,
  actions,
  children,
}: TablePageWrapperProps) {
  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        className="mb-2"
      />
      {children}
    </PageContainer>
  );
}
