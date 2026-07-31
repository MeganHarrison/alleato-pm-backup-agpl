"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, CheckCircle2, Ban, Eye } from "lucide-react";

import {
  BoardView,
  type BoardColumnDefinition,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InsightRow } from "./insights-types";
import { SEVERITY_VARIANT_MAP } from "./insights-types";

const BOARD_COLUMNS: BoardColumnDefinition[] = [
  {
    id: "open",
    label: "Open",
    laneClassName: "bg-destructive/5 dark:bg-destructive/10",
    countClassName:
      "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
    emptyLabel: "No open insights",
  },
  {
    id: "blocked",
    label: "Blocked",
    laneClassName: "bg-orange-50/80 dark:bg-orange-950/20",
    countClassName:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    emptyLabel: "Nothing blocked",
  },
  {
    id: "needs_review",
    label: "Needs Review",
    laneClassName: "bg-amber-50/80 dark:bg-amber-950/20",
    countClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    emptyLabel: "Nothing to review",
  },
  {
    id: "stale",
    label: "Stale",
    laneClassName: "bg-muted/40",
    countClassName:
      "bg-muted text-muted-foreground",
    emptyLabel: "No stale insights",
  },
  {
    id: "resolved",
    label: "Resolved",
    laneClassName: "bg-emerald-50/80 dark:bg-emerald-950/20",
    countClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    emptyLabel: "Nothing resolved yet",
  },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="h-3 w-3" />,
  blocked: <Ban className="h-3 w-3" />,
  needs_review: <Eye className="h-3 w-3" />,
  stale: <Clock className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
};

function InsightCard({
  item,
  onClick,
}: {
  item: InsightRow;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full h-auto text-left rounded-lg p-3 bg-muted/40 hover:bg-muted/70 transition-all duration-150",
      )}
    >
      <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">
        {item.title}
      </p>

      <div className="flex flex-wrap gap-1 mb-2">
        <Badge
          variant={
            (SEVERITY_VARIANT_MAP[item.severity] as
              | "destructive"
              | "default"
              | "outline"
              | "secondary") ?? "outline"
          }
          className="text-xs capitalize"
        >
          {item.severity}
        </Badge>
        <Badge variant="outline" className="text-xs capitalize">
          {item.type.replace(/_/g, " ")}
        </Badge>
      </div>

      {item.project_name && (
        <p className="text-xs text-muted-foreground truncate">
          {item.project_name}
        </p>
      )}

      {item.owner && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {item.owner}
        </p>
      )}

      {item.next_action && (
        <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2 border-t border-border/40 pt-2">
          {item.next_action}
        </p>
      )}
    </Button>
  );
}

interface InsightsBoardViewProps {
  items: InsightRow[];
  onRowClick?: (item: InsightRow) => void;
}

export function InsightsBoardView({ items, onRowClick }: InsightsBoardViewProps) {
  const router = useRouter();

  const handleClick = (item: InsightRow) => {
    if (onRowClick) {
      onRowClick(item);
    } else {
      router.push(`/insights/${item.id}`);
    }
  };

  return (
    <BoardView
      columns={BOARD_COLUMNS}
      items={items}
      getItemId={(item) => item.id}
      getColumnId={(item) => item.status}
      renderCard={(item) => (
        <InsightCard item={item} onClick={() => handleClick(item)} />
      )}
    />
  );
}
