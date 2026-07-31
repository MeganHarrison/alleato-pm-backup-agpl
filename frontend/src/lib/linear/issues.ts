interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
}

interface LinearGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

function getLinearApiKey(): string {
  const apiKey = process.env.LINEAR_MCP_TOKEN ?? process.env.LINEAR_API_KEY;
  const normalized = apiKey?.trim().replace(/^["']|["']$/g, "");
  if (!normalized) {
    throw new Error("LINEAR_MCP_TOKEN or LINEAR_API_KEY is not configured.");
  }
  if (normalized.startsWith("Bearer ") || normalized.startsWith("lin_api_")) {
    return normalized;
  }
  return `Bearer ${normalized}`;
}

async function linearGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(process.env.LINEAR_API_URL ?? LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: getLinearApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Linear credentials were rejected. Update LINEAR_MCP_TOKEN or LINEAR_API_KEY.");
    }
    throw new Error(`Linear API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as LinearGraphqlResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Linear API returned an empty response.");
  }

  return payload.data;
}

async function resolveLinearTeamId(): Promise<string> {
  const configuredTeamId = process.env.LINEAR_ERROR_TEAM_ID ?? process.env.LINEAR_DEFAULT_TEAM_ID;
  if (configuredTeamId?.trim()) return configuredTeamId.trim();

  const teamKey = (
    process.env.LINEAR_ERROR_TEAM_KEY ??
    process.env.LINEAR_DEFAULT_TEAM_KEY ??
    "AAI"
  ).trim().toUpperCase();

  const data = await linearGraphql<{
    teams: { nodes: LinearTeam[] };
  }>(
    `
      query LinearTeams {
        teams(first: 100) {
          nodes {
            id
            key
            name
          }
        }
      }
    `,
  );

  const team = data.teams.nodes.find((candidate) => candidate.key.toUpperCase() === teamKey);
  if (!team) {
    throw new Error(`Linear team key ${teamKey} was not found.`);
  }

  return team.id;
}

export async function createLinearIssue(params: {
  title: string;
  description: string;
}): Promise<LinearIssue> {
  const teamId = await resolveLinearTeamId();
  const data = await linearGraphql<{
    issueCreate: {
      success: boolean;
      issue: LinearIssue | null;
    };
  }>(
    `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `,
    {
      input: {
        teamId,
        title: params.title,
        description: params.description,
      },
    },
  );

  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new Error("Linear issue creation did not return a created issue.");
  }

  return data.issueCreate.issue;
}
