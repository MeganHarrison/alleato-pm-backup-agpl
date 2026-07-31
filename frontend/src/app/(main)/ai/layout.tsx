/**
 * Layout for the AI section.
 * Keeps chat immersive while allowing child AI tools to own their page layout.
 */
export default function AiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      {children}
    </div>
  );
}
