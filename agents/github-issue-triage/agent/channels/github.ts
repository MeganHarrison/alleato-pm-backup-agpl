import { defaultGitHubAuth, githubChannel } from "eve/channels/github";

import {
  buildIssueContext,
  buildManualRetriageContext,
  determineIssueDispatch,
  readIssueBody,
  readIssueLabels,
  readIssueTitle,
  shouldDispatchComment,
} from "../lib/triage.js";

const botName = process.env.GITHUB_APP_SLUG ?? "eve-github-triage";
const triageActions = new Set(["edited", "labeled", "opened", "reopened"]);

export default githubChannel({
  botName,
  progress: { reactions: false },
  onPullRequest(ctx, pullRequest) {
    if (pullRequest.action !== "opened") return null;
    return { auth: defaultGitHubAuth(ctx) };
  },
  onIssue(ctx, issue) {
    if (!triageActions.has(issue.action)) return null;

    const dispatch = determineIssueDispatch({
      action: issue.action,
      labels: readIssueLabels(issue.raw),
      repositoryFullName: ctx.repository.fullName,
    });
    if (dispatch.kind === "ignore") return null;

    return {
      auth: defaultGitHubAuth(ctx),
      context: buildIssueContext({
        action: issue.action,
        body: readIssueBody(issue.raw),
        dispatch,
        issueNumber: issue.issueNumber,
        labels: readIssueLabels(issue.raw),
        repositoryFullName: ctx.repository.fullName,
        title: readIssueTitle(issue.raw),
      }),
    };
  },
  onComment(ctx, comment) {
    if (!shouldDispatchComment(comment.body, botName)) return null;

    const issueNumber = ctx.conversation.issueNumber ?? ctx.conversation.pullRequestNumber;
    return {
      auth: defaultGitHubAuth(ctx),
      context: buildManualRetriageContext({
        body: comment.body,
        conversationKind: ctx.conversation.kind,
        issueNumber,
        repositoryFullName: ctx.repository.fullName,
      }),
    };
  },
});
