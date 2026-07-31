import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Dashboard | Alleato",
  description: "This route has been retired in favor of the AI Dashboard.",
};

export default function AiDashboardProjectsPage() {
  redirect("/ai-dashboard");
}
