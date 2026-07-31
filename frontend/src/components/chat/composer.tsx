"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AtSign, Paperclip, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ComposerProps {
  onSend: (content: string) => void;
  channelName: string;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

export function Composer({
  onSend,
  channelName,
  disabled,
  placeholder,
}: ComposerProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="bg-background px-4 py-3">
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2 transition-colors focus-within:border-primary/40 focus-within:bg-background">
        {/* Toolbar icons */}
        <div className="flex shrink-0 items-center gap-0.5 pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            title="Emoji"
          >
            <Smile className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            title="Mention"
          >
            <AtSign className="h-4 w-4" />
          </Button>
        </div>

        {/* Input */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Message ${channelName}`}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0"
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          className={cn(
            "mb-0.5 h-8 w-8 shrink-0 rounded-xl transition-all",
            message.trim() ? "opacity-100" : "opacity-40",
          )}
          title="Send (Enter)"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
        Enter to send · Shift + Enter for new line
      </p>
    </div>
  );
}
