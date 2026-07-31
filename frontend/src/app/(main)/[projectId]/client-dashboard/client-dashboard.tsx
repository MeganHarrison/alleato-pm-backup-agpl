"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  FileText,
  MapPin,
  Milestone,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/ds";
import { PageTabs } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

 
interface ClientDashboardProps {
  project: any;
  primeContract: any | null;
  milestones: any[];
  rfis: any[];
  documents: any[];
}

export default function ClientDashboard({
  project,
  primeContract,
  milestones,
  rfis,
  documents,
}: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const projectProgress = primeContract?.percent_complete || 0;
  const daysRemaining = primeContract?.substantial_completion_date
    ? Math.ceil(
        (new Date(primeContract.substantial_completion_date).getTime() -
          new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
    );
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case "active":
      case "approved":
      case "complete":
        return "default";
      case "pending":
      case "in_progress":
        return "secondary";
      case "rejected":
      case "delayed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="container mx-auto p-4 space-y-8 sm:p-6">
        {/* Header */}
        <div className="bg-card rounded-xl shadow-sm border p-4 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-4xl">
                {project.name}
              </h1>
              <p className="text-lg text-muted-foreground mt-2">
                {project["job number"] &&
                  `Project #${project["job number"]} - `}
                Client Dashboard
              </p>
              {project.address && (
                <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{project.address}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <Badge className="mb-2" variant={getStatusVariant(project.state)}>
                {project.state || "Active"}
              </Badge>
              {primeContract && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contract Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      primeContract.revised_contract_amount ||
                        primeContract.contract_amount
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {primeContract && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Project Progress</span>
                <span className="text-sm text-muted-foreground">
                  {projectProgress}% Complete
                </span>
              </div>
              <Progress value={projectProgress} className="h-3" />
              {daysRemaining !== null && daysRemaining > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {daysRemaining} days remaining until substantial completion
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="text-xl font-semibold">
                    {primeContract?.start_date
                      ? format(
                          new Date(primeContract.start_date),
                          "MMM d, yyyy"
                        )
                      : "TBD"}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completion Date</p>
                  <p className="text-xl font-semibold">
                    {primeContract?.substantial_completion_date
                      ? format(
                          new Date(
                            primeContract.substantial_completion_date
                          ),
                          "MMM d, yyyy"
                        )
                      : "TBD"}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open RFIs</p>
                  <p className="text-xl font-semibold">{rfis.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Milestones</p>
                  <p className="text-xl font-semibold">{milestones.length}</p>
                </div>
                <Milestone className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="space-y-6">
          <PageTabs
            tabs={[
              {
                label: "Overview",
                href: "overview",
                isActive: activeTab === "overview",
              },
              {
                label: "Schedule",
                href: "schedule",
                isActive: activeTab === "schedule",
              },
              {
                label: "Documents",
                href: "documents",
                isActive: activeTab === "documents",
              },
            ]}
            variant="inline"
            className="mb-0"
            onTabClick={(href) => setActiveTab(href as typeof activeTab)}
          />

          {/* Overview Tab */}
          {activeTab === "overview" ? (
            <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contract Details */}
              {primeContract && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Prime Contract
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Contract Number
                        </p>
                        <p className="font-medium">
                          {primeContract.contract_number}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Title</p>
                        <p className="font-medium">{primeContract.title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Execution Date
                        </p>
                        <p className="font-medium">
                          {primeContract.execution_date
                            ? format(
                                new Date(primeContract.execution_date),
                                "MMMM d, yyyy"
                              )
                            : "Pending"}
                        </p>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Original Amount
                          </p>
                          <p className="font-medium">
                            {formatCurrency(primeContract.contract_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Current Amount
                          </p>
                          <p className="font-medium">
                            {formatCurrency(
                              primeContract.revised_contract_amount ||
                                primeContract.contract_amount
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* RFIs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Open RFIs
                  </CardTitle>
                  <CardDescription>
                    Requests for Information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rfis.length > 0 ? (
                    <div className="space-y-4">
                      {rfis.map((rfi) => (
                        <div
                          key={rfi.id}
                          className="flex items-start justify-between"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                #{rfi.rfi_number}
                              </span>
                              <Badge
                                variant={getStatusVariant(rfi.status)}
                                className="text-xs"
                              >
                                {rfi.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {rfi.subject}
                            </p>
                            {rfi.date_submitted && (
                              <p className="text-xs text-muted-foreground">
                                Submitted{" "}
                                {format(
                                  new Date(rfi.date_submitted),
                                  "MMM d"
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No open RFIs at this time
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Milestones */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Milestone className="h-5 w-5" />
                    Key Milestones
                  </CardTitle>
                  <CardDescription>
                    Major project milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {milestones.length > 0 ? (
                    <div className="space-y-4">
                      {milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {milestone.name}
                            </p>
                            {milestone.end_date && (
                              <p className="text-xs text-muted-foreground">
                                {format(
                                  new Date(milestone.end_date),
                                  "MMM d, yyyy"
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={milestone.percent_complete || 0}
                              className="w-20 h-2"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {milestone.percent_complete || 0}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No milestones defined
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
            </div>
          ) : null}

          {/* Schedule Tab */}
          {activeTab === "schedule" ? (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Schedule</CardTitle>
                <CardDescription>Key dates and milestones</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {milestones.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {milestones.map((milestone) => (
                        <TableRow key={milestone.id}>
                          <TableCell className="font-medium">
                            {milestone.name}
                          </TableCell>
                          <TableCell>
                            {milestone.start_date
                              ? format(
                                  new Date(milestone.start_date),
                                  "MMM d, yyyy"
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {milestone.end_date
                              ? format(
                                  new Date(milestone.end_date),
                                  "MMM d, yyyy"
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={milestone.percent_complete || 0}
                                className="w-20 h-2"
                              />
                              <span className="text-sm">
                                {milestone.percent_complete || 0}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    icon={<Milestone />}
                    title="No schedule milestones available"
                    description="Milestones will appear here once added to the project schedule."
                  />
                )}
              </CardContent>
            </Card>
            </div>
          ) : null}

          {/* Documents Tab */}
          {activeTab === "documents" ? (
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Documents</CardTitle>
                <CardDescription>
                  Important project files and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {doc.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {doc.file_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {doc.uploaded_at
                              ? format(
                                  new Date(doc.uploaded_at),
                                  "MMM d, yyyy"
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {doc.file_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() =>
                                  window.open(doc.file_url, "_blank")
                                }
                              >
                                <Download />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    icon={<FileText />}
                    title="No documents available"
                    description="Project documents will appear here once uploaded."
                  />
                )}
              </CardContent>
            </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
