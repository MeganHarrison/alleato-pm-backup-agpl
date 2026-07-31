import { requireDeveloper } from "@/lib/auth/require-developer";

export default async function ProgressReportsTableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeveloper();

  return <>{children}</>;
}
