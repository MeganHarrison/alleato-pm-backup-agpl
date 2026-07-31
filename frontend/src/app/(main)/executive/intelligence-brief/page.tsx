import { redirect } from "next/navigation";

// This is intentionally a redirect-only compatibility route; /daily-brief owns the page shell.
// eslint-disable-next-line design-system/require-page-shell
export default function IntelligenceBriefPage() {
  redirect("/daily-brief");
}
