"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { DailyLogFormClient } from "@/components/daily-log/DailyLogFormClient";

export default function NewDailyLogPage() {
  const params = useParams()! ?? {};
  const projectId = Number(params.projectId);

  return <DailyLogFormClient projectId={projectId} mode="create" />;
}
