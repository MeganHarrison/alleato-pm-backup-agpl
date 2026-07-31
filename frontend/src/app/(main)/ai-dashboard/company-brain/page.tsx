import { permanentRedirect } from "next/navigation";

export const metadata = {
  title: "Company Brain | AI Dashboard | Alleato",
  description:
    "A living map of your company’s institutional knowledge — meetings, messages, documents, decisions, and project activity flowing into the AI brain.",
};

// Redirect-only compatibility route; the canonical page shell lives at /ai/company-brain.
// eslint-disable-next-line design-system/require-page-shell
export default async function AiDashboardCompanyBrainPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["range", "focus", "q"]) {
    const value = params[key];
    if (typeof value === "string") next.set(key, value);
  }
  permanentRedirect(`/ai/company-brain${next.size ? `?${next.toString()}` : ""}`);
}
