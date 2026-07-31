/**
 * Layout for AI Assistant page.
 * Keeps the assistant mounted in a full-height canvas.
 */
export default function AIAssistantLayout({
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
