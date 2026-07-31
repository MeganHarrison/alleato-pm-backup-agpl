export interface CardViewSettings {
  showCover: boolean;
  showLabels: boolean;
  showLinkPreview: boolean;
  showDescription: boolean;
  showAssignee: boolean;
  showDueDate: boolean;
  showSeverity: boolean;
  showCommentCount: boolean;
}

export const DEFAULT_CARD_VIEW_SETTINGS: CardViewSettings = {
  showCover: true,
  showLabels: true,
  showLinkPreview: true,
  showDescription: false,
  showAssignee: true,
  showDueDate: true,
  showSeverity: true,
  showCommentCount: true,
};

const STORAGE_KEY = "board-card-view-settings";

export function loadCardViewSettings(): CardViewSettings {
  if (typeof window === "undefined") return DEFAULT_CARD_VIEW_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CARD_VIEW_SETTINGS;
    return { ...DEFAULT_CARD_VIEW_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CARD_VIEW_SETTINGS;
  }
}

export function saveCardViewSettings(s: CardViewSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}
