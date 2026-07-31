// Force all auth routes to be dynamically rendered to avoid SSR issues
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages use a minimal layout without header/sidebar
  // They inherit ThemeProvider and QueryProvider from root layout
  // but render their own structure
  return children;
}
