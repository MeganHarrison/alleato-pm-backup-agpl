"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface VerticalMarkup {
  id: string;
  project_id: number | null;
  markup_type: string;
  percentage: number;
  calculation_order: number;
  compound: boolean | null;
}

export function useVerticalMarkup(projectId: number | undefined) {
  const [markupRows, setMarkupRows] = useState<VerticalMarkup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    async function fetchMarkup() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("vertical_markup")
          .select("*")
          .eq("project_id", projectId as number)
          .order("calculation_order", { ascending: true });

        if (error) throw error;
        setMarkupRows(
          (data || []).map((row) => ({
            ...row,
            percentage: Number(row.percentage),
          }))
        );
      } catch {
        setMarkupRows([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMarkup();
  }, [projectId]);

  return { markupRows, isLoading };
}
