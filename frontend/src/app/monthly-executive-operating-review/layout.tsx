import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";

export default function MonthlyExecutiveOperatingReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedAppProviders>{children}</AuthenticatedAppProviders>;
}
