"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AssistantSuggestion } from "@/lib/ai/assistant-suggestion-resolver";
import { cn } from "@/lib/utils";

type AssistantSuggestionListProps = {
  disabled?: boolean;
  suggestions: AssistantSuggestion[];
  variant?: "compact" | "inline" | "panel";
  onSelectPrompt: (prompt: string) => void;
};

export function AssistantSuggestionList({
  disabled = false,
  suggestions,
  variant = "inline",
  onSelectPrompt,
}: AssistantSuggestionListProps) {
  if (suggestions.length === 0) return null;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
        {suggestions.map((suggestion) => {
          const className =
            "max-w-full text-left font-medium leading-5 text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:text-muted-foreground";

          if (suggestion.href && suggestion.status !== "not_ready" && !disabled) {
            return (
              <Link key={suggestion.id} href={suggestion.href} className={className}>
                {suggestion.label}
              </Link>
            );
          }

          return (
            <Button
              key={suggestion.id}
              type="button"
              variant="link"
              size="xs"
              disabled={disabled || suggestion.status === "not_ready"}
              className={cn(
                className,
                "h-auto min-h-0 shrink whitespace-normal p-0 text-xs",
              )}
              onClick={() => onSelectPrompt(suggestion.prompt)}
            >
              {suggestion.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-left",
        variant === "panel" && "mb-4 rounded-lg bg-muted/45 px-3 py-3",
      )}
    >
      {variant === "panel" ? (
        <div className="mb-3 space-y-1">
          <p className="text-sm font-medium text-foreground">Welcome back.</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Here are the most useful AI actions for where you are.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {suggestions.map((suggestion) => {
          const content = (
            <span className="line-clamp-2 whitespace-normal leading-4">
              {suggestion.label}
            </span>
          );

          if (suggestion.href && suggestion.status !== "not_ready" && !disabled) {
            return (
              <Button
                key={suggestion.id}
                asChild
                variant="ghost"
                className="min-h-16 min-w-0 items-start justify-start rounded-md bg-muted/35 px-3 py-2.5 text-left text-xs font-medium text-foreground shadow-none hover:bg-muted/55 disabled:opacity-50"
              >
                <Link href={suggestion.href}>{content}</Link>
              </Button>
            );
          }

          return (
            <Button
              key={suggestion.id}
              type="button"
              variant="ghost"
              disabled={disabled || suggestion.status === "not_ready"}
              className="min-h-16 min-w-0 items-start justify-start rounded-md bg-muted/35 px-3 py-2.5 text-left text-xs font-medium text-foreground shadow-none hover:bg-muted/55 disabled:opacity-50"
              onClick={() => onSelectPrompt(suggestion.prompt)}
            >
              {content}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
