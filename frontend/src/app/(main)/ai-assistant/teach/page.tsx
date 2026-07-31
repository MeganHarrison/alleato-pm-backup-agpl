import { redirect } from "next/navigation";

export const metadata = {
  title: "Teach Alleato | Alleato",
  description: "Submit reviewed workflow knowledge for Alleato AI.",
};

export default function TeachAlleatoPage() {
  redirect("/ai/teach");
}
