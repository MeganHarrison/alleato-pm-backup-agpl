"use client";

import { MessageSquare, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE, feedbackTargetProps } from "@/lib/admin-feedback/constants";
import { AskAITab } from "./tabs/AskAITab";
import { FeedbackTab } from "./tabs/FeedbackTab";

export type AskAlleatoPanelTab = "ai" | "feedback";

export function AskAlleatoPanel({
  open,
  onOpenChange,
  activeTab,
  onActiveTabChange,
  pagePath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: AskAlleatoPanelTab;
  onActiveTabChange: (tab: AskAlleatoPanelTab) => void;
  pagePath: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
        {...feedbackTargetProps("ask-alleato.panel")}
        {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
      >
        <DialogTitle className="sr-only">Ask Alleato</DialogTitle>
        <Tabs
          value={activeTab}
          onValueChange={(value) => onActiveTabChange(value as AskAlleatoPanelTab)}
          className="gap-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feedback">
              <MessageSquare className="size-3.5" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="size-3.5" />
              Alleato AI
            </TabsTrigger>
          </TabsList>
          <div className="p-5">
            <TabsContent value="feedback" className="mt-0">
              <FeedbackTab pagePath={pagePath} onSubmitted={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <AskAITab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
