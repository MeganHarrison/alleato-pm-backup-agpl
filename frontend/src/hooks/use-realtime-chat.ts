"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    name: string;
  };
  createdAt: string;
}

interface UseRealtimeChatOptions {
  roomName: string;
  username: string;
}

interface BroadcastPayload {
  message: ChatMessage;
}

export const useRealtimeChat = ({
  roomName,
  username,
}: UseRealtimeChatOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(roomName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }: { payload: BroadcastPayload }) => {
        setMessages((prev) => [...prev, payload.message]);
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomName]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!channelRef.current || !content.trim()) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content: content.trim(),
        user: { name: username },
        createdAt: new Date().toISOString(),
      };

      channelRef.current.send({
        type: "broadcast",
        event: "message",
        payload: { message },
      });

      // Optimistically add own message immediately
      setMessages((prev) => [...prev, message]);
    },
    [username],
  );

  return { messages, sendMessage, isConnected };
};
