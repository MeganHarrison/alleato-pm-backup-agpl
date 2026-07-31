"use client";

import { ChevronDown, Download, FileText, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageActionsProps {
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export function PageActions({ onExportCsv, onExportPdf }: PageActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download />
          Export
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportPdf}>
          <FileText />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCsv}>
          <Table2 />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
