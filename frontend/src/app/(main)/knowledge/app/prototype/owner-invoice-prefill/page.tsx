import { PageShell } from "@/components/layout";
import { OwnerInvoicePrefillPrototype } from "@/features/invoicing/owner-invoice-prefill-prototype";

export default function OwnerInvoicePrefillPrototypePage() {
  return (
    <PageShell
      variant="form"
      title="Owner invoice prefill prototype"
      description="Interactive model using representative project data. Nothing is saved."
    >
      <OwnerInvoicePrefillPrototype />
    </PageShell>
  );
}
