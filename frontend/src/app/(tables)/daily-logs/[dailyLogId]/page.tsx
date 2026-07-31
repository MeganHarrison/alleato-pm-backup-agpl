import { PageShell } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";

export default async function DailyLogDetail({ params }: { params: Promise<{ dailyLogId: string }> }) {
  const { dailyLogId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("daily_logs").select("*").eq("id", dailyLogId).single();

  return (
    <PageShell variant="detail" title="Daily Log Detail">
      <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </PageShell>
  );
}
