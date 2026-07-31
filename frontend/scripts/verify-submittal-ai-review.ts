import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import * as reviewRunServiceModule from "@/lib/submittals/ai-review/review-run-service";

const createSubmittalAIReviewService =
  reviewRunServiceModule.createSubmittalAIReviewService ??
  reviewRunServiceModule.default?.createSubmittalAIReviewService;

if (typeof createSubmittalAIReviewService !== "function") {
  throw new Error("Could not load createSubmittalAIReviewService from review-run-service.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendRoot = resolve(__dirname, "..");
const repoRoot = resolve(frontendRoot, "..");

config({ path: resolve(repoRoot, ".env"), quiet: true });
config({ path: resolve(frontendRoot, ".env.local"), quiet: true });

type Args = {
  projectId: number | null;
  submittalIds: string[];
  reviewerEmail: string | null;
  reviewerUserId: string | null;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    projectId: null,
    submittalIds: [],
    reviewerEmail: process.env.TEST_USER_1 ?? "test1@mail.com",
    reviewerUserId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project-id") {
      args.projectId = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--submittal-id") {
      args.submittalIds.push(argv[++index] ?? "");
    } else if (arg === "--reviewer-email") {
      args.reviewerEmail = argv[++index] ?? null;
    } else if (arg === "--reviewer-user-id") {
      args.reviewerUserId = argv[++index] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  ../node_modules/.bin/tsx --tsconfig tsconfig.json scripts/verify-submittal-ai-review.ts [options]

Options:
  --project-id <number>         Required project ID for the scoped review service.
  --submittal-id <uuid>         Repeatable. One or more submittal IDs to review.
  --reviewer-email <email>      Resolve auth user by email. Default: TEST_USER_1 or test1@mail.com
  --reviewer-user-id <uuid>     Explicit auth user ID override.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.projectId)) {
    throw new Error("--project-id is required.");
  }
  if (args.submittalIds.length === 0) {
    throw new Error("At least one --submittal-id is required.");
  }

  return args;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function resolveReviewerUserId(args: Args) {
  if (args.reviewerUserId) return args.reviewerUserId;
  if (!args.reviewerEmail) {
    throw new Error("Reviewer email is required when --reviewer-user-id is not provided.");
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;

  const match = data.users.find(
    (user) => user.email?.toLowerCase() === args.reviewerEmail?.toLowerCase(),
  );
  if (!match?.id) {
    throw new Error(`Could not resolve auth user for ${args.reviewerEmail}.`);
  }
  return match.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reviewerUserId = await resolveReviewerUserId(args);
  const reviewService = createSubmittalAIReviewService(reviewerUserId);
  const results = [];

  for (const submittalId of args.submittalIds) {
    const result = await reviewService.runReview(args.projectId!, submittalId);
    results.push({
      projectId: args.projectId,
      submittalId,
      reviewerUserId,
      status: result.status,
      summary: result.summary,
      readiness: result.readiness,
      sourceCoverage: result.sourceCoverage,
      checkSummary: result.checks.map((check) => ({
        title: check.title,
        status: check.status,
        checkType: check.checkType,
        confidence: check.confidence,
      })),
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
