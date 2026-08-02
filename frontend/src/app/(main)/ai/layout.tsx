/**
 * Layout for the AI section.
 * Lets child AI tools use the application's scroll container. The `/ai` chat
 * page owns its fixed-height pane locally, so the section layout must not clip
 * non-chat descendants.
 */
export default function AiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {children}
    </div>
  );
}
