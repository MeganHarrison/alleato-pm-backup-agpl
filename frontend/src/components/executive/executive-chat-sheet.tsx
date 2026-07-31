"use client";

import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ExecutiveChatPanel } from "@/components/executive/executive-chat-panel";
import type { BrandonDailyUpdatePacket } from "@/lib/executive/brandon-daily-update";

export function ExecutiveChatSheet({
  packet,
}: {
  packet: BrandonDailyUpdatePacket;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="sm" className="gap-2">
          <MessageSquareText className="h-4 w-4" />
          Discuss with AI
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="gap-0 p-0 md:max-w-xl lg:max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Discuss executive brief with AI</SheetTitle>
          <SheetDescription>
            Ask questions about the current executive briefing packet.
          </SheetDescription>
        </SheetHeader>
        <ExecutiveChatPanel packet={packet} presentation="sheet" />
      </SheetContent>
    </Sheet>
  );
}
