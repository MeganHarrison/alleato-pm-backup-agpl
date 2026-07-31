"use client";

import * as React from "react";
import { Send, Sparkles } from "lucide-react";
import { ErrorState } from "@/components/ds";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getMessageText, useAskAlleatoChat } from "../useAskAlleatoChat";

const EXAMPLES = [
  "What's blocking the Tampa project?",
  "Show me overdue RFIs assigned to me",
  "Summarize last week's owner meeting",
];

export function AskAITab() {
  const [input, setInput] = React.useState("");
  const { messages, send, isStreaming, error } = useAskAlleatoChat();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextInput = input.trim();
    if (!nextInput) return;
    setInput("");
    await send(nextInput);
  };

  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <InfoAlert variant="info" className="border-0 bg-muted/50 text-foreground">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Try asking
              </div>
              <div className="flex flex-col gap-1 text-[13px]">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInput(example)}
                    className="h-auto justify-start px-0 py-0 text-left font-normal hover:bg-transparent hover:text-primary"
                  >
                    - {example}
                  </Button>
                ))}
              </div>
            </div>
          </InfoAlert>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message);
            if (!text) return null;
            return (
              <div
                key={message.id}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "inline-block max-w-sm rounded-2xl bg-foreground px-3 py-2 text-sm leading-relaxed text-background"
                      : "inline-block max-w-sm rounded-2xl bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
                  }
                >
                  {text}
                </div>
              </div>
            );
          })
        )}
        {isStreaming && (
          <InfoAlert
            variant="info"
            icon={<Sparkles className="size-3 animate-pulse" />}
            className="inline-flex rounded-full border-0 bg-muted px-3 py-1.5 text-xs text-muted-foreground"
          >
            Reading project context
          </InfoAlert>
        )}
        {error && (
          <ErrorState title="Ask Alleato could not respond" error={error} className="py-4" />
        )}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything about your projects..."
          className="min-h-20 text-sm"
          disabled={isStreaming}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!input.trim() || isStreaming}>
            <Send className="size-3.5" />
            Ask
          </Button>
        </div>
      </form>
    </div>
  );
}
