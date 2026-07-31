"use client";

import { useSearchParams } from "next/navigation";

import { ChatTab } from "@/components/dev-panel/ChatTab";
import { FeedbackTab } from "@/components/dev-panel/FeedbackTab";
import { GapsTab } from "@/components/dev-panel/GapsTab";
import { OverviewTab } from "@/components/dev-panel/OverviewTab";
import { ScreenshotsPageTab } from "@/components/dev-panel/ScreenshotsPageTab";
import { SpecTab } from "@/components/dev-panel/SpecTab";
import { TestCasesTab } from "@/components/dev-panel/TestCasesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  slug: string;
  description: string | null;
}

// Tabs that have internal sidebar+scroll layouts need an explicit height
// so they look right. All others flow naturally with the page.
const SCROLLABLE_TAB_HEIGHT = "min-h-[600px] h-[70vh]";

const VALID_TABS = ["overview", "screenshots", "spec", "gaps", "scenarios", "test-matrix", "feedback", "chat"];

export function ToolDetailTabs({ slug, description }: Props) {
  const searchParams = useSearchParams()! ?? new URLSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = VALID_TABS.includes(tabParam ?? "") ? (tabParam as string) : "scenarios";

  return (
    <div className="mt-4">
      {description && (
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="test-matrix">Test Matrix</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="chat">Ask AI</TabsTrigger>
        </TabsList>

        {/* Natural-height tabs — scroll with the page */}
        <TabsContent value="scenarios" className="m-0">
          <TestCasesTab slug={slug} />
        </TabsContent>

        <TabsContent value="test-matrix" className="m-0">
          <TestCasesTab slug={slug} />
        </TabsContent>

        <TabsContent value="overview" className="m-0">
          <OverviewTab feature={slug} />
        </TabsContent>

        <TabsContent value="screenshots" className="m-0">
          <ScreenshotsPageTab feature={slug} />
        </TabsContent>

        {/* Sidebar-split tabs — need explicit height for their internal layout */}
        <TabsContent value="spec" className={`m-0 overflow-hidden rounded-lg border border-border ${SCROLLABLE_TAB_HEIGHT}`}>
          <SpecTab feature={slug} />
        </TabsContent>

        <TabsContent value="gaps" className={`m-0 overflow-hidden rounded-lg border border-border ${SCROLLABLE_TAB_HEIGHT}`}>
          <GapsTab feature={slug} />
        </TabsContent>

        <TabsContent value="feedback" className={`m-0 overflow-hidden rounded-lg border border-border ${SCROLLABLE_TAB_HEIGHT}`}>
          <FeedbackTab feature={slug} />
        </TabsContent>

        <TabsContent value="chat" className={`m-0 overflow-hidden rounded-lg border border-border ${SCROLLABLE_TAB_HEIGHT}`}>
          <ChatTab feature={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
