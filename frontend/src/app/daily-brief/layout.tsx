import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";

export default function DailyBriefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppProviders>{children}</AuthenticatedAppProviders>;
}
