"use server";

// Stub actions — these functions are referenced by message-editor and
// use-chat-visibility but the original implementation was removed.
// TODO: wire up to real chat persistence if needed.

export async function deleteTrailingMessages(_args: {
  id: string;
}): Promise<void> {
  // no-op stub
}

export async function updateChatVisibility(_args: {
  chatId: string;
  visibility: string;
}): Promise<void> {
  // no-op stub
}
