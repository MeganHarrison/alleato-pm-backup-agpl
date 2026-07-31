import { redirect } from "next/navigation";

/**
 * The company portfolio at `/` is the canonical project-table owner. Keep this
 * legacy route as a redirect so saved links do not retain a second set of
 * filters, actions, and data-loading behavior.
 */
export default function ProjectsPage() {
  redirect("/");
}
