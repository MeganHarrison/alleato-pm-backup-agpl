import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Documentation",
    default: "Documentation",
  },
  description: "Controlled Alleato OS application documentation",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      {children}
    </div>
  );
}
