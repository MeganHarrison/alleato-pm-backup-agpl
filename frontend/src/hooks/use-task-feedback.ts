"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import type {
  TaskFeedbackReasonCategory,
  TaskSnapshot,
} from "@/lib/ai/task-feedback-types";

export type FeedbackSignal = "good" | "bad";

interface UseTaskFeedbackOptions {
  projectId?: number | null;
  taskId?: string | null;
  taskSnapshot: TaskSnapshot;
  sessionId?: string | null;
}

interface UseTaskFeedbackReturn {
  signal: FeedbackSignal | null;
  isSubmitting: boolean;
  submitFeedback: (
    signal: FeedbackSignal,
    reason?: string,
    reasonCategory?: TaskFeedbackReasonCategory | null,
  ) => Promise<void>;
}

export function useTaskFeedback(options: UseTaskFeedbackOptions): UseTaskFeedbackReturn {
  const [signal, setSignal] = useState<FeedbackSignal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the signal whenever the underlying task changes so stale feedback
  // from a previously-selected task doesn't bleed into the new task's UI.
  useEffect(() => {
    setSignal(null);
  }, [options.taskId]);

  const submitFeedback = useCallback(
    async (
      newSignal: FeedbackSignal,
      reason?: string,
      reasonCategory?: TaskFeedbackReasonCategory | null,
    ) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        await apiFetch("/api/ai-assistant/task-feedback", {
          method: "POST",
          body: JSON.stringify({
            projectId: options.projectId,
            taskId: options.taskId ?? null,
            signal: newSignal,
            reasonCategory: reasonCategory ?? null,
            reason: reason ?? null,
            taskSnapshot: options.taskSnapshot,
            sessionId: options.sessionId ?? null,
          }),
        });
        setSignal(newSignal);
      } finally {
        setIsSubmitting(false);
      }
    },
    [options, isSubmitting],
  );

  return { signal, isSubmitting, submitFeedback };
}
