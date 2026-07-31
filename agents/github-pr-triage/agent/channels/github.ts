import { defaultGitHubAuth, githubChannel } from "eve/channels/github";

export default githubChannel({
  onPullRequest: (ctx, pullRequest) =>
    pullRequest.action === "opened" ? { auth: defaultGitHubAuth(ctx) } : null,
  events: {
    "turn.started": async (_data, channel) => {
      try {
        await channel.thread.react("eyes");
      } catch {
        // A failed acknowledgement reaction must never fail triage.
      }
    },
  },
});
