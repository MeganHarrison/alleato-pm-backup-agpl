import type { TeamChannel } from "./team-chat-data";

export function resolveInitialTeamChatChannelId(
  channels: TeamChannel[],
  activeChannel: string,
  initialDiscussionId?: string | null,
): string | null {
  if (channels.length === 0) {
    return null;
  }

  if (initialDiscussionId) {
    const commentInboxChannel = channels.find(
      (channel) => channel.id === "comments-inbox",
    );
    if (commentInboxChannel) {
      return commentInboxChannel.id;
    }
  }

  const hasActive = channels.some((channel) => channel.id === activeChannel);
  if (hasActive) {
    return activeChannel;
  }

  return channels[0]?.id ?? null;
}
