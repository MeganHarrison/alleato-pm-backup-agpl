#!/usr/bin/env node
import "dotenv/config";

const backendUrl = (
  process.env.PYTHON_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  "https://alleato-backend-rbnj.onrender.com"
).replace(/\/$/, "");
const minGatewayCredits = Number(process.env.AI_GATEWAY_MIN_CREDITS_USD || "1");
const warnGatewayCredits = Number(process.env.AI_GATEWAY_WARN_CREDITS_USD || "5");

async function fetchGatewayCredits() {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required for the credit balance probe",
    };
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error?.message || JSON.stringify(payload),
    };
  }
  return {
    ok: true,
    balance: Number(payload.balance),
    totalUsed: Number(payload.total_used),
    raw: payload,
  };
}

async function main() {
  const response = await fetch(`${backendUrl}/health`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Render backend health returned HTTP ${response.status}`);
  }

  const health = await response.json();
  const failures = [];
  const warnings = [];

  if (health.ai_gateway_configured !== true) {
    failures.push("AI_GATEWAY_API_KEY is not visible to the Render backend");
  }

  if (health.embedding_provider_configured !== true) {
    failures.push("No embedding provider is configured on the Render backend");
  }

  if ("supabase_service_configured" in health && health.supabase_service_configured !== true) {
    failures.push("Supabase service key is not visible to the Render backend");
  }

  const credits = await fetchGatewayCredits();
  if (!credits.ok) {
    failures.push(`AI Gateway credit probe failed: ${credits.error}`);
  } else if (!Number.isFinite(credits.balance)) {
    failures.push(`AI Gateway credit probe returned a non-numeric balance: ${JSON.stringify(credits.raw)}`);
  } else if (credits.balance < minGatewayCredits) {
    failures.push(
      `AI Gateway credits are below the hard floor: balance=$${credits.balance.toFixed(4)}, floor=$${minGatewayCredits.toFixed(2)}`
    );
  } else if (credits.balance < warnGatewayCredits) {
    warnings.push(
      `AI Gateway credits are below the warning floor: balance=$${credits.balance.toFixed(4)}, warning=$${warnGatewayCredits.toFixed(2)}`
    );
  }

  if (failures.length > 0) {
    console.error("Render AI health check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error(`Backend: ${backendUrl}`);
    console.error(`Health payload: ${JSON.stringify(health)}`);
    if (credits.ok) {
      console.error(`AI Gateway credits: ${JSON.stringify(credits.raw)}`);
    }
    process.exit(1);
  }

  console.log("Render AI health check passed");
  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log(JSON.stringify({ ...health, ai_gateway_credits: credits.raw }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
