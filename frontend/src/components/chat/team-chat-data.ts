export interface TeamChannel {
  id: string;
  name: string;
  topic: string;
  team: string;
  section: "channels" | "dm";
  unread: number;
  memberCount: number;
  preview: string;
  lastMessageAt: string | null;
  deletable: boolean;
  isDm?: boolean;
  dmPartnerId?: string;
  dmPartnerName?: string;
  source?: "comments";
  readOnly?: boolean;
}

export interface TeamChatAdminUser {
  id: string;
  name: string;
}
