/* eslint-disable design-system/require-page-shell -- redirect-only compatibility route; the rendered page at /errors owns PageShell. */
import { redirect } from "next/navigation";

export default function AdminErrorsRedirectPage() {
  redirect("/errors");
}
