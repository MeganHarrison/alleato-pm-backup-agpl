/**
 * The (procore) route group is nested under /(admin), which already provides
 * the full app shell (sidebar, site header, footer, chat widget).
 *
 * Rendering another shell here duplicates the site header and sidebar on routes
 * like /procore-tools/[slug]. Keep this layout pass-through.
 */
export default function ProcoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
