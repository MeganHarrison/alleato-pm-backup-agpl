/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";
import { Check, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createPlanePageBlock, PLANE_PAGE_BLOCK_LABELS } from "./editor-utils";
import type { PlanePageBlock, PlanePageBlockType } from "./types";

interface PlaneBlockEditorProps {
  blocks: PlanePageBlock[];
  onChange: (blocks: PlanePageBlock[]) => void;
}

const blockTextClassNames: Record<PlanePageBlockType, string> = {
  paragraph: "text-base leading-7",
  heading: "text-xl font-semibold leading-tight tracking-tight",
  bullet: "text-base leading-7",
  numbered: "text-base leading-7",
  quote: "text-base italic leading-7 text-muted-foreground",
  check: "text-base leading-7",
};

function blockPrefix(block: PlanePageBlock, index: number) {
  if (block.type === "bullet") return "•";
  if (block.type === "numbered") return `${index + 1}.`;
  return null;
}

export function PlaneBlockEditor({ blocks, onChange }: PlaneBlockEditorProps) {
  const blockRefs = React.useRef(new Map<string, HTMLTextAreaElement>());

  const updateBlock = (blockId: string, patch: Partial<PlanePageBlock>) => {
    onChange(
      blocks.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block,
      ),
    );
  };

  const addBlockAfter = (
    blockId: string,
    type: PlanePageBlockType = "paragraph",
  ) => {
    const index = blocks.findIndex((block) => block.id === blockId);
    const nextBlock = createPlanePageBlock(type);
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, nextBlock);
    onChange(nextBlocks);
    requestAnimationFrame(() => blockRefs.current.get(nextBlock.id)?.focus());
  };

  const removeBlock = (blockId: string) => {
    if (blocks.length === 1) {
      updateBlock(blockId, { text: "", type: "paragraph", checked: false });
      return;
    }
    const index = blocks.findIndex((block) => block.id === blockId);
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    onChange(nextBlocks);
    requestAnimationFrame(() =>
      blockRefs.current.get(nextBlocks[Math.max(0, index - 1)]?.id)?.focus(),
    );
  };

  return (
    <div aria-label="Page blocks" className="pb-64">
      {blocks.map((block, index) => {
        const prefix = blockPrefix(block, index);
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            className="group/block flex min-w-0 items-start gap-1 py-1"
          >
            <div className="flex min-h-11 shrink-0 items-center opacity-100 md:opacity-0 md:transition-opacity md:group-hover/block:opacity-100 md:group-focus-within/block:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-md"
                aria-label="Add block below"
                onClick={() => addBlockAfter(block.id)}
              >
                <Plus className="size-4" />
              </Button>
              <span
                className="hidden size-6 place-items-center text-muted-foreground md:grid"
                aria-hidden="true"
              >
                <GripVertical className="size-4" />
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-start gap-2">
              {block.type === "check" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "mt-2 grid size-6 shrink-0 place-items-center rounded-md border border-border text-primary",
                    block.checked && "bg-primary text-primary-foreground",
                  )}
                  aria-label={
                    block.checked ? "Mark incomplete" : "Mark complete"
                  }
                  aria-pressed={Boolean(block.checked)}
                  onClick={() =>
                    updateBlock(block.id, { checked: !block.checked })
                  }
                >
                  {block.checked ? <Check className="size-4" /> : null}
                </Button>
              ) : prefix ? (
                <span className="min-w-6 pt-2 text-right text-base text-muted-foreground">
                  {prefix}
                </span>
              ) : null}

              <Textarea
                ref={(element) => {
                  if (element) blockRefs.current.set(block.id, element);
                  else blockRefs.current.delete(block.id);
                }}
                rows={1}
                value={block.text}
                aria-label={`Block ${index + 1}, ${PLANE_PAGE_BLOCK_LABELS[block.type]}`}
                placeholder={index === 0 ? "Start writing" : "Continue writing"}
                className={cn(
                  "min-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-2 text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0",
                  blockTextClassNames[block.type],
                  block.checked && "text-muted-foreground line-through",
                )}
                onChange={(event) => {
                  updateBlock(block.id, { text: event.target.value });
                  event.currentTarget.style.height = "auto";
                  event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.metaKey &&
                    !event.ctrlKey
                  ) {
                    event.preventDefault();
                    addBlockAfter(
                      block.id,
                      block.type === "heading" ? "paragraph" : block.type,
                    );
                  }
                  if (
                    event.key === "Backspace" &&
                    block.text.length === 0 &&
                    blocks.length > 1
                  ) {
                    event.preventDefault();
                    removeBlock(block.id);
                  }
                }}
              />

              <Select
                value={block.type}
                onValueChange={(value) =>
                  updateBlock(block.id, {
                    type: value as PlanePageBlockType,
                    checked:
                      value === "check" ? Boolean(block.checked) : undefined,
                  })
                }
              >
                <SelectTrigger
                  aria-label={`Change block ${index + 1} type`}
                  className="mt-1 min-h-11 w-32 px-2 opacity-100 md:opacity-0 md:group-hover/block:opacity-100 md:group-focus-within/block:opacity-100"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLANE_PAGE_BLOCK_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1 size-11 shrink-0 rounded-md opacity-100 hover:text-destructive md:opacity-0 md:group-hover/block:opacity-100 md:group-focus-within/block:opacity-100"
                aria-label={`Delete block ${index + 1}`}
                onClick={() => removeBlock(block.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
