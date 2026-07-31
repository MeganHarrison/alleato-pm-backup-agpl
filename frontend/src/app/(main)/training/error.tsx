"use client";

import { RouteErrorPage } from "@/components/layout";

export default function TrainingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorPage error={error} reset={reset} />;
}
