"use client";

import { useState } from "react";
import { updateChatVisibility } from "@/app/ai-sdk/actions";
import type { VisibilityType } from "@/components/ai-chat/visibility-selector";

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const [visibilityType, setLocalVisibility] = useState(initialVisibilityType);

  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(updatedVisibilityType);
    void updateChatVisibility({
      chatId,
      visibility: updatedVisibilityType,
    });
  };

  return { visibilityType, setVisibilityType };
}
