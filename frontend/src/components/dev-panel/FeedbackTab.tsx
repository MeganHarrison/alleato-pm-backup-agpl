"use client";

import * as React from "react";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  title: string;
  comment: string;
  status: string;
  severity: string | null;
  request_type: string;
  page_url: string;
  page_path: string;
  created_at: string;
  github_issue_url: string | null;
  github_issue_state: string | null;
}

interface FeedbackData {
  feature: string;
  tool: { id: number; name: string } | null;
  feedback: FeedbackItem[];
}

interface Props {
  feature: string | null;
}

const statusColor: Record<string, string> = {
  open:        "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  resolved:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed:      "bg-muted text-muted-foreground",
  wont_fix:    "bg-muted text-muted-foreground",
};

const severityColor: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-orange-600 dark:text-orange-400",
  medium:   "text-amber-600 dark:text-amber-400",
  low:      "text-muted-foreground",
};

export function FeedbackTab({ feature }: Props) {
  const [data, setData] = React.useState<FeedbackData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState("open");

  React.useEffect(() => {
    if (!feature) return;
    setLoading(true);
    fetch(`/api/dev-panel/feedback/${feature}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [feature]);

  if (loading) return <Empty>Loading feedback…</Empty>;
  if (!feature || !data) return <Empty>No feedback data available.</Empty>;

  const items = data.feedback;
  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const openCount = items.filter((i) => i.status === "open").length;

  if (items.length === 0) return <Empty>No client feedback found for this feature.</Empty>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {items.length} items · {openCount} open
          {data.tool && <span className="ml-2 font-medium text-foreground">{data.tool.name}</span>}
        </p>
        <div className="flex items-center gap-1">
          {["all", "open", "in_progress", "resolved"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] transition-colors",
                filter === s
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {filtered.length === 0 ? (
          <Empty>No {filter.replace("_", " ")} feedback.</Empty>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-2 mb-1">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", statusColor[item.status] ?? statusColor.open)}>
                  {item.status.replace("_", " ")}
                </span>
                {item.severity && (
                  <span className={cn("text-[10px] font-medium capitalize", severityColor[item.severity] ?? "")}>
                    {item.severity}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{item.comment}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {item.github_issue_url && (
                  <a
                    href={item.github_issue_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline shrink-0"
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
                    #{item.github_issue_url.split("/").pop()}
                    {item.github_issue_state && (
                      <span className="ml-0.5 text-muted-foreground">({item.github_issue_state})</span>
                    )}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
