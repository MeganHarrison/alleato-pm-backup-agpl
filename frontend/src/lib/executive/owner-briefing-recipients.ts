/**
 * Owner Briefing Recipients — authoritative list of who receives the daily
 * Teams brief.
 *
 * The legacy executive-briefing-teams-delivery.ts blasted to every user in
 * `teams_conversation_refs` (anyone who'd ever DM'd the bot). That's wrong for
 * an OWNER briefing — this message is for Brandon (owner) and Megan (operator
 * who triages and forwards items). Scope explicitly here so the recipient set
 * doesn't drift as more users register with the bot.
 *
 * The list is sourced from `bot_user_mappings` rows (platform='teams') for
 * each named owner. If a user is removed from bot_user_mappings, the delivery
 * call will skip them with a logged reason and continue with the rest.
 */

export type OwnerBriefingRecipient = {
  supabaseUserId: string;
  displayName: string;
  email: string;
  /** First-name greeting for the card subtitle. */
  firstName: string;
};

/**
 * The fixed recipient list. supabaseUserId values come from bot_user_mappings
 * (queried at migration time, see migration history for verification).
 *
 * To rotate or add a recipient, add a row here AND ensure the user has DM'd
 * the Archon bot at least once (so teams_conversation_refs has their thread).
 */
export const OWNER_BRIEFING_RECIPIENTS: OwnerBriefingRecipient[] = [
  {
    supabaseUserId: "2af4889b-f1a0-489e-a165-f5de5805e03a",
    displayName: "Brandon Clymer",
    email: "bclymer@alleatogroup.com",
    firstName: "Brandon",
  },
  {
    supabaseUserId: "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0",
    displayName: "Megan Harrison",
    email: "mharrison@alleatogroup.com",
    firstName: "Megan",
  },
];
