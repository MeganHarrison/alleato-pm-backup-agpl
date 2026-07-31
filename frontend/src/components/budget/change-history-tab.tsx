"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Filter, Download, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

interface ChangeHistoryTabProps {
  projectId: string;
}

interface ChangeRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  costCode?: string;
  description?: string;
}

interface HistoryStatistics {
  totalChanges: number;
  changesThisMonth: number;
  activeUsers: number;
  lastChange: string | null;
}

interface HistoryData {
  changes: ChangeRecord[];
  statistics: HistoryStatistics;
}

export function ChangeHistoryTab({ projectId }: ChangeHistoryTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [historyData, setHistoryData] = React.useState<HistoryData | null>(
    null,
  );

  const fetchHistory = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<typeof historyData>(`/api/projects/${projectId}/budget/history`);
      setHistoryData(data);
    } catch (error) {
      toast.error("Failed to load change history");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatFieldName = (field: string) => {
    return field
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getActionBadgeVariant = (
    action: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (action.toLowerCase()) {
      case "insert":
      case "create":
        return "default";
      case "update":
      case "modify":
        return "secondary";
      case "delete":
      case "remove":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const changes = historyData?.changes || [];
  const statistics = historyData?.statistics;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="text-2xl font-bold tracking-tight">
            Budget Change History
          </h2>
          <p className="text-muted-foreground">
            Complete audit trail of all budget modifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchHistory}>
            <Filter />
            Refresh
          </Button>
          <Button
            onClick={() => toast.info("Export functionality coming soon")}
          >
            <Download />
            Export Log
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.totalChanges || 0}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.changesThisMonth || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Budget modifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Change</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.lastChange
                ? new Date(statistics.lastChange).toLocaleDateString()
                : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.lastChange
                ? new Date(statistics.lastChange).toLocaleTimeString()
                : "No changes yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.activeUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Making changes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Log</CardTitle>
          <CardDescription>
            Detailed history of all budget line modifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Clock className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-medium">No Changes Recorded</p>
                <p className="text-sm">Budget modifications will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{change.user}</span>
                      <Badge
                        variant={getActionBadgeVariant(change.action)}
                        className="text-xs"
                      >
                        {change.action}
                      </Badge>
                      {change.costCode && (
                        <span className="text-xs text-muted-foreground">
                          {change.costCode}
                        </span>
                      )}
                    </div>
                    {change.description && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {change.description}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Changed <strong>{formatFieldName(change.field)}</strong>{" "}
                      from{" "}
                      <span className="font-mono">
                        {change.oldValue || "(empty)"}
                      </span>{" "}
                      to{" "}
                      <span className="font-mono">
                        {change.newValue || "(empty)"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(change.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Note:</strong> All budget changes are automatically tracked
          and logged. This audit trail is permanent and cannot be modified to
          ensure data integrity.
        </p>
      </div>
    </div>
  );
}
