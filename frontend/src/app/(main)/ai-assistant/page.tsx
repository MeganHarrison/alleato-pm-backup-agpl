import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "AI Assistant | Alleato",
  description: "Chat with your meeting transcripts using AI-powered insights",
};

export default async function AIAssistantPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  const resolvedSearchParams = await searchParams;

  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  redirect(params.size > 0 ? `/ai?${params.toString()}` : "/ai");

  return (
    <PageShell variant="content" title="AI" showHeader={false}>
      Redirecting to AI.
    </PageShell>
  );
}
