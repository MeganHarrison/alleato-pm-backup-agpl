"use client";
import { RouteErrorPage } from "@/components/layout/RouteErrorPage";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorPage error={error} reset={reset} />;
}
