"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { ErrorState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  FileText,
  Calendar,
  Brain,
  AlertCircle,
  Users,
  Building2,
  ClipboardList,
  MessageSquare,
  DollarSign,
  Briefcase,
  UserCheck,
  CalendarDays,
  FileCheck,
  ListTodo,
  Lightbulb,
  TrendingUp,
  ArrowRight,
  LucideIcon,
} from "lucide-react";

// Map icon names to Lucide icon components
const iconMap: Record<string, LucideIcon> = {
  CalendarDays,
  FileText,
  MessageSquare,
  ListTodo,
  ClipboardList,
  FileCheck,
  Calendar,
  AlertCircle,
  DollarSign,
  Briefcase,
  Building2,
  Users,
  UserCheck,
  Brain,
  Lightbulb,
  TrendingUp,
  Database,
};

interface TableMetadata {
  id: string;
  table_name: string;
  display_name: string;
  description: string | null;
  category: string;
  icon_name: string;
  is_visible: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

const categoryColors: Record<string, string> = {
  "Core Data": "bg-blue-100 text-blue-800",
  "Project Management": "bg-green-100 text-green-800",
  Financial: "bg-purple-100 text-purple-800",
  Directory: "bg-orange-100 text-orange-800",
  "AI Insights": "bg-pink-100 text-pink-800",
};

// Map table names to their URLs
const getTableHref = (tableName: string): string => {
  const hrefMap: Record<string, string> = {
    daily_logs: "/daily-logs",
    daily_reports: "/daily-reports",
    meeting_segments: "/meeting-segments",
    notes: "/notes",
    tasks: "/tasks",
    rfis: "/rfis",
    punch_list: "/punch-list",
    document_metadata: "/meetings",
    risks: "/risks",
    commitments_unified: "/commitments",
    clients: "/clients",
    companies: "/directory/companies",
    people: "/directory/contacts",
    employees: "/employees",
    users: "/directory/users",
    ai_decisions: "/decisions",
    ai_insights: "/insights",
    opportunities: "/opportunities",
  };

  return hrefMap[tableName] || `/${tableName}`;
};

export default function TablesDirectoryPage() {
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const data = await apiFetch<TableMetadata[]>("/api/table-metadata");
        setTables(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  if (loading) {
    return (
      <PageShell
        variant="table"
        title="Data Tables Directory"
        description="Browse and access all data tables in the system."
      >
        <p className="text-sm text-muted-foreground">Loading tables...</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        variant="table"
        title="Data Tables Directory"
        description="Browse and access all data tables in the system."
      >
        <ErrorState error={error} />
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="table"
      title="Data Tables Directory"
      description="Browse and access all data tables in the system. Click on any row to view the table."
    >
      <div className="bg-card rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Table Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-40">Category</TableHead>
              <TableHead className="w-24 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => {
              const Icon = iconMap[table.icon_name] || Database;
              const href = getTableHref(table.table_name);

              return (
                <TableRow
                  key={table.id}
                  className="cursor-pointer hover:bg-neutral-50"
                  onClick={() => window.location.href = href}
                >
                  <TableCell>
                    <Icon className="h-5 w-5 text-neutral-400" />
                  </TableCell>
                  <TableCell className="font-medium text-neutral-900">
                    {table.display_name}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    {table.description || "No description available"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={categoryColors[table.category] || "bg-muted text-foreground"}
                    >
                      {table.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ArrowRight className="h-4 w-4 text-neutral-400 inline" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm text-neutral-500">
        <span className="font-medium">{tables.length} total tables</span>
        <span>•</span>
        <div className="flex items-center gap-4">
          {Object.entries(categoryColors).map(([category, color]) => (
            <div key={category} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${color.split(' ')[0]}`} />
              <span className="text-xs">{category}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
