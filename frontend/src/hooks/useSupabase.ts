"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useMemo } from "react";
import type { Database } from "@/types/database.types";

export function useSupabase() {
  const supabase = useMemo(() => {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }, []);

  return supabase;
}
