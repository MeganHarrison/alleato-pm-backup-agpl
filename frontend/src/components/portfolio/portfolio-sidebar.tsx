"use client";

import * as React from "react";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PortfolioSidebarProps {
  customReports: { id: string; name: string }[];
  onCreateProject?: () => void;
  onReportClick?: (reportId: string) => void;
}

export function PortfolioSidebar({
  customReports,
  onCreateProject,
  onReportClick,
}: PortfolioSidebarProps) {
  const [isReportsExpanded, setIsReportsExpanded] = React.useState(true);

  return (
    <div className="w-64 bg-background border-l border-border flex flex-col">
      {/* Create Project button */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={onCreateProject}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          <Plus />
          Create Project
        </Button>
      </div>

      {/* Custom Reports section */}
      <div className="flex-1 overflow-auto">
        <Button
          variant="ghost"
          onClick={() => setIsReportsExpanded(!isReportsExpanded)}
          className="w-full flex items-center justify-between px-4 py-4 text-sm font-medium text-foreground hover:bg-muted rounded-none h-auto"
        >
          <span>Custom Reports</span>
          <ChevronRight
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isReportsExpanded && "rotate-90",
            )}
          />
        </Button>

        {isReportsExpanded && (
          <div className="px-2 pb-2">
            {customReports.length > 0 ? (
              customReports.map((report) => (
                <Button
                  key={report.id}
                  variant="ghost"
                  onClick={() => onReportClick?.(report.id)}
                  className="w-full flex items-center justify-start gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted rounded h-auto"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {report.name}
                </Button>
              ))
            ) : (
              <p className="px-4 py-2 text-sm text-muted-foreground">
                No custom reports yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          {customReports.length} custom report
          {customReports.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
