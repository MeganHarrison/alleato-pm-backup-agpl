import type { Metadata } from "next";
import { PageShell } from "@/components/layout";
import { OutlookIntakeClient } from "./outlook-intake-client";

export const metadata: Metadata = {
  title: "Outlook Intake",
};

export default function OutlookIntakePage() {
  return (
    <PageShell
      variant="table"
      title="Outlook Intake"
      showHeader={false}
      contentClassName="pt-0"
    >
      <OutlookIntakeClient />
    </PageShell>
  );
}
