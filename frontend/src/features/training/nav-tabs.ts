export interface TrainingNavTab {
  label: string;
  href: string;
}

/**
 * The training hub's own nav links (rendered by TrainingNav), matching the
 * standalone "Own Your Growth" hub's nav order. "Start Here" (role skill
 * libraries) isn't a distinct route in this app — its content lives on
 * /training/growth alongside the Skill Wheel — so it's omitted here.
 */
export const TRAINING_NAV_TABS: TrainingNavTab[] = [
  { label: "Training Library", href: "/training/library" },
  { label: "The Method", href: "/training/method" },
  { label: "AI Prompts", href: "/training/prompts" },
  { label: "My Growth", href: "/training/growth" },
  // "Manager Coaching" (/training/coaching) is intentionally NOT listed yet.
  // The launch screen shipped ahead of its destinations: its primary CTA points
  // at /training/coaching/new, and the session cards at
  // /training/coaching/[sessionId] — neither route exists, so both 404. The page
  // itself is left routable (deep links and the in-progress work still resolve);
  // it is only unadvertised. Restore this entry in the same commit that lands the
  // session workspace.
  { label: "Ask the Library (AI)", href: "/training/ask" },
];
