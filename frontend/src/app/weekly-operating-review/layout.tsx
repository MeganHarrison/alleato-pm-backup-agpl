import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";

export default function WeeklyOperatingReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppProviders>{children}</AuthenticatedAppProviders>;
}
