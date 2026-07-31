import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Operating System | Alleato",
  description: "This route has moved to the AI Dashboard.",
};

export default function AiDashboardAiOsPage() {
  redirect("/ai-dashboard");
}
