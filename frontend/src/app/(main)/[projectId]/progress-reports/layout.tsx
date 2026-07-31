import { requireDeveloper } from "@/lib/auth/require-developer";

export default async function ProgressReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeveloper();

  return <>{children}</>;
}
