"use client";

import { useState } from "react";
import { toast } from "sonner";
import styles from "@/app/(main)/training/training-theme.module.css";

export interface PromptListProps {
  prompts: string[];
}

const COPIED_RESET_MS = 2000;

export function PromptList({ prompts }: PromptListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleCopy(prompt: string, index: number) {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      toast.error(
        "Could not copy this prompt. Select the text and copy it manually.",
      );
      return;
    }

    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex((current) => (current === index ? null : current));
    }, COPIED_RESET_MS);
  }

  return (
    <div className={styles.prompts}>
      {prompts.map((prompt, index) => {
        const isCopied = copiedIndex === index;
        return (
          <div key={prompt} className={styles.prompt}>
            <p>{prompt}</p>
            <button
              type="button"
              aria-label={isCopied ? "Copied" : `Copy ${prompt}`}
              className={isCopied ? `${styles.copy} ${styles.copyOk}` : styles.copy}
              onClick={() => handleCopy(prompt, index)}
            >
              {isCopied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
