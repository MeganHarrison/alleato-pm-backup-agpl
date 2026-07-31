export type DailyBriefHistoryItemCounts = {
  needsBrandon: number;
  waitingOnOthers: number;
  importantUpdates: number;
  total: number;
};

export type DailyBriefHistoryItem = {
  id: string;
  recapDate: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  workflowStatus: string;
  approvedAt: string | null;
  sentAt: string | null;
  sentTeams: boolean;
  sentEmail: boolean;
  createdAt: string | null;
  generatedAt: string | null;
  modelUsed: string | null;
  windowDays: number | null;
  hasPacket: boolean;
  itemCounts: DailyBriefHistoryItemCounts;
  sourceCoverageCount: number;
  sourceWarningCount: number;
};

export type DailyBriefHistoryResponse = {
  briefs: DailyBriefHistoryItem[];
};
