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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Calendar, Download, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

interface SnapshotsTabProps {
  projectId: string;
}

interface Snapshot {
  id: string;
  name: string;
  description?: string;
  snapshot_date: string;
  total_budget: number;
  total_costs: number;
  variance: number;
  created_at: string;
}

interface SnapshotsData {
  snapshots: Snapshot[];
  current: {
    totalBudget: number;
    totalCosts: number;
    variance: number;
    snapshotDate: string;
  };
  count: number;
}

export function SnapshotsTab({ projectId }: SnapshotsTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [snapshotsData, setSnapshotsData] =
    React.useState<SnapshotsData | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [compareA, setCompareA] = React.useState<string>("");
  const [compareB, setCompareB] = React.useState<string>("");

  const fetchSnapshots = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<SnapshotsData>(
        `/api/projects/${projectId}/budget/snapshots`,
      );
      setSnapshotsData(data);
    } catch (error) {
      toast.error("Failed to load snapshots", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createSnapshot = React.useCallback(async () => {
    try {
      setCreating(true);
      await apiFetch(
        `/api/projects/${projectId}/budget/snapshots`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `Snapshot ${new Date().toLocaleDateString()}`,
            description: "Manual snapshot",
          }),
        },
      );

      toast.success("Snapshot created successfully");
      await fetchSnapshots();
    } catch (error) {
      toast.error("Failed to create snapshot", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setCreating(false);
    }
  }, [projectId, fetchSnapshots]);

  React.useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-success";
    if (variance < 0) return "text-destructive";
    return "text-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = snapshotsData?.current;
  const snapshots = snapshotsData?.snapshots || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="text-2xl font-bold tracking-tight">
            Project Status Snapshots
          </h2>
          <p className="text-muted-foreground">
            Capture and compare budget states at different project milestones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSnapshots}>
            <History />
            Refresh
          </Button>
          <Button onClick={createSnapshot} disabled={creating}>
            <Camera />
            {creating ? "Creating..." : "Create Snapshot"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-border/80 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Budget</CardTitle>
              <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                Active
              </span>
            </div>
            <CardDescription className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              {new Date().toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Budget:</span>
                <span className="font-medium">
                  {formatCurrency(current?.totalBudget || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Costs:</span>
                <span className="font-medium">
                  {formatCurrency(current?.totalCosts || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Variance:</span>
                <span
                  className={`font-medium ${getVarianceColor(current?.variance || 0)}`}
                >
                  {formatCurrency(current?.variance || 0)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4"
              onClick={() => toast.info("Export functionality coming soon")}
            >
              <Download />
              Export
            </Button>
          </CardContent>
        </Card>

        {snapshots.length === 0 ? (
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-base">No Snapshots Created</CardTitle>
              <CardDescription className="text-xs">
                Create your first snapshot to track budget changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Click "Create Snapshot" above</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          snapshots.map((snapshot) => (
            <Card
              key={snapshot.id}
              className="hover:border-border/80 transition-colors cursor-pointer"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{snapshot.name}</CardTitle>
                </div>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {new Date(snapshot.snapshot_date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Budget:</span>
                    <span className="font-medium">
                      {formatCurrency(snapshot.total_budget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Costs:</span>
                    <span className="font-medium">
                      {formatCurrency(snapshot.total_costs)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variance:</span>
                    <span
                      className={`font-medium ${getVarianceColor(snapshot.variance)}`}
                    >
                      {formatCurrency(snapshot.variance)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => toast.info("Export functionality coming soon")}
                >
                  <Download />
                  Export
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot Comparison</CardTitle>
          <CardDescription>
            Compare any two budget snapshots side by side
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length < 2 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <History className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-medium">No Snapshots to Compare</p>
                <p className="text-sm">
                  Create at least two snapshots to enable comparison
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">Snapshot A</span>
                  <Select value={compareA} onValueChange={setCompareA}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select snapshot..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">Snapshot B</span>
                  <Select value={compareB} onValueChange={setCompareB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select snapshot..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(() => {
                const snapshotA = snapshots.find((s) => s.id === compareA);
                const snapshotB = snapshots.find((s) => s.id === compareB);
                if (!snapshotA || !snapshotB || snapshotA.id === snapshotB.id) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select two different snapshots to compare
                    </p>
                  );
                }
                const budgetChange = snapshotB.total_budget - snapshotA.total_budget;
                const costChange = snapshotB.total_costs - snapshotA.total_costs;
                const varianceChange = snapshotB.variance - snapshotA.variance;
                return (
                  <div className="rounded-lg bg-muted/40 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div />
                      <div className="text-center font-medium">{snapshotA.name}</div>
                      <div className="text-center font-medium">{snapshotB.name}</div>
                    </div>
                    {[
                      { label: "Total Budget", a: snapshotA.total_budget, b: snapshotB.total_budget, delta: budgetChange },
                      { label: "Total Costs", a: snapshotA.total_costs, b: snapshotB.total_costs, delta: costChange },
                      { label: "Variance", a: snapshotA.variance, b: snapshotB.variance, delta: varianceChange },
                    ].map(({ label, a, b, delta }) => (
                      <div key={label} className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-muted-foreground">{label}</div>
                        <div className="text-center">{formatCurrency(a)}</div>
                        <div className="text-center">
                          {formatCurrency(b)}
                          <span className={`ml-2 text-xs ${getVarianceColor(delta)}`}>
                            {delta > 0 ? "+" : ""}{formatCurrency(delta)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> Create snapshots at key project milestones
          (e.g., design completion, permit approval, construction start) to
          track how your budget evolves throughout the project lifecycle.
        </p>
      </div>
    </div>
  );
}
