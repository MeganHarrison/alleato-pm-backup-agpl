import { PageShell } from "@/components/layout";

import { BrandGuideContent } from "./brand-guide-content";

export default function BrandGuidePage() {
  return (
    <PageShell variant="detailXWide" title="Brand guide" showHeader={false}>
      <BrandGuideContent />
    </PageShell>
  );
}
