"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useWindowSize } from "usehooks-ts";

import type { UISuggestion } from "@/lib/editor/suggestions";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "./artifact";
import { CrossIcon, MessageIcon } from "./icons";
import { Button } from '@/components/ui/button';

export const Suggestion = ({
  suggestion,
  onApply,
  artifactKind,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  artifactKind: ArtifactKind;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { width: windowWidth } = useWindowSize();

  return (
    <AnimatePresence>
      {isExpanded ? (
        <motion.div
          animate={{ opacity: 1, y: -20 }}
          className="absolute -right-12 z-50 flex w-56 flex-col gap-4 rounded-2xl border bg-background p-4 font-sans text-sm shadow-sm md:-right-16"
          exit={{ opacity: 0, y: -10 }}
          initial={{ opacity: 0, y: -10 }}
          key={suggestion.id}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          whileHover={{ scale: 1.05 }}
        >
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <div className="size-4 rounded-full bg-muted-foreground/25" />
              <div className="font-medium">Assistant</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-muted-foreground"
              onClick={() => {
                setIsExpanded(false);
              }}
            >
              <CrossIcon size={12} />
            </Button>
          </div>
          <div>{suggestion.description}</div>
          <Button
            className="w-fit rounded-full px-4 py-1.5"
            onClick={onApply}
            variant="outline"
          >
            Apply
          </Button>
        </motion.div>
      ) : (
        <motion.div
          className={cn("cursor-pointer p-1 text-muted-foreground", {
            "absolute -right-8": artifactKind === "text",
            "sticky top-0 right-4": artifactKind === "code",
          })}
          onClick={() => {
            setIsExpanded(true);
          }}
          whileHover={{ scale: 1.1 }}
        >
          <MessageIcon size={windowWidth && windowWidth < 768 ? 16 : 14} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
