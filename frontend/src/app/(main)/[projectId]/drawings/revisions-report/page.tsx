"use client";

import * as React from "react";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText } from "lucide-react";

import { PageShell } from "@/components/layout";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ds";
import { useDrawings } from "@/hooks/use-drawings";
import type { DrawingLogTableRow } from "@/types/drawings.types";

const tabs = (projectId: string) => [
  { label: "Current Drawings", href: `/${projectId}/drawings`, isActive: false },
  { label: "Drawing Sets", href: `/${projectId}/drawings/sets`, isActive: false },
  { label: "Recycle Bin", href: `/${projectId}/drawings/recycle-bin`, isActive: false },
];


export default function DrawingsRevisionsReportPage() {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const projectId = params.projectId ?? "";
  const [search, setSearch] = useState("");

  const { data: drawingsData, isLoading } = useDrawings(projectId, {
    page: 1,
    page_size: 500,
    include_unpublished: true,
    include_obsolete: true,
  });

  const drawings: DrawingLogTableRow[] = React.useMemo(
    () => drawingsData?.drawings ?? [],
    [drawingsData],
  );

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drawings;
    return drawings.filter(
      (d) =>
        d.drawingNumber.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q),
    );
  }, [drawings, search]);

  const handleExportCSV = () => {
    const rows = filteredItems.map((d) => [
      d.drawingNumber,
      d.title,
      d.discipline ?? "",
      d.revisionNumber ?? "",
      d.setName ?? "",
      d.drawingDate ?? "",
      d.receivedDate ?? "",
      d.status ?? "",
      d.isPublished ? "Yes" : "No",
      d.isObsolete ? "Yes" : "No",
    ]);
    const header = [
      "Number",
      "Title",
      "Discipline",
      "Revision",
      "Set",
      "Drawing Date",
      "Received Date",
      "Status",
      "Published",
      "Obsolete",
    ];
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drawings-all-revisions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      variant="table"
      title="All Sets & Revisions"
      description="Complete drawing log including all revisions, unpublished, and obsolete drawings."
      tabs={tabs(projectId)}
      actions={
        <Button size="sm" variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-4">
        <ExpandableSearch
          placeholder="Search by number or title..."
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead>Set</TableHead>
              <TableHead>Drawing Date</TableHead>
              <TableHead>Received Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Published</TableHead>
              <TableHead className="text-center">Obsolete</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16">
                  <EmptyState
                    icon={<FileText className="h-8 w-8 text-muted-foreground" />}
                    title="No drawings found"
                    description={
                      search
                        ? "Try adjusting your search."
                        : "No drawings have been uploaded to this project yet."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((drawing) => (
                <TableRow
                  key={drawing.id}
                  className={
                    drawing.isObsolete
                      ? "text-muted-foreground opacity-60"
                      : undefined
                  }
                >
                  <TableCell className="font-mono text-sm">
                    {drawing.drawingNumber}
                  </TableCell>
                  <TableCell>
                    <span className={drawing.isObsolete ? "italic" : undefined}>
                      {drawing.title}
                    </span>
                  </TableCell>
                  <TableCell>{drawing.discipline ?? "—"}</TableCell>
                  <TableCell>{drawing.revisionNumber ?? "—"}</TableCell>
                  <TableCell>{drawing.setName ?? "—"}</TableCell>
                  <TableCell>{formatDate(drawing.drawingDate)}</TableCell>
                  <TableCell>{formatDate(drawing.receivedDate)}</TableCell>
                  <TableCell>
                    {drawing.status ? (
                      <Badge variant="secondary" className="capitalize">
                        {drawing.status}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {drawing.isPublished ? (
                      <Badge variant="default">Yes</Badge>
                    ) : (
                      <Badge variant="outline">Unpublished</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {drawing.isObsolete ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {drawing.fileUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={drawing.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && filteredItems.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {filteredItems.length} drawing{filteredItems.length !== 1 ? "s" : ""} shown
          {search ? ` matching "${search}"` : ""}
        </p>
      )}
    </PageShell>
  );
}
