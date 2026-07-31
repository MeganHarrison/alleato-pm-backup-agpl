import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL environment variable is not set for tests",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY environment variable is not set for tests",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export function getMirrorClient() {
  const mirrorUrl = process.env.SUPABASE_MIRROR_URL;
  const mirrorKey = process.env.SUPABASE_MIRROR_SERVICE_ROLE_KEY;

  if (!mirrorUrl || !mirrorKey) {
    return null;
  }

  return createClient(mirrorUrl, mirrorKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function fetchPrimeContract(contractId: string) {
  const { data, error } = await supabaseAdmin
    .from("prime_contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchContractLineItems(contractId: string) {
  const { data, error } = await supabaseAdmin
    .from("contract_line_items")
    .select("*")
    .eq("contract_id", contractId)
    .order("line_number", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function fetchContractAttachments(contractId: string) {
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("*")
    .eq("attached_to_id", contractId)
    .eq("attached_to_table", "prime_contracts");

  if (error) {
    throw error;
  }

  return data || [];
}

function extractStoragePath(url: string | null) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(
      /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/,
    );
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function deletePrimeContractCascade(contractId: string) {
  const attachments = await fetchContractAttachments(contractId);
  const filePaths = attachments
    .map((attachment) => extractStoragePath(attachment.url))
    .filter((path): path is string => Boolean(path));

  if (filePaths.length > 0) {
    await supabaseAdmin.storage.from("project-files").remove(filePaths);
  }

  await supabaseAdmin
    .from("attachments")
    .delete()
    .eq("attached_to_id", contractId)
    .eq("attached_to_table", "prime_contracts");

  // Clean up Phase 6 payment infrastructure (added 2026-02-24)
  await supabaseAdmin.from("prime_contract_payments").delete().eq("contract_id", contractId);
  await supabaseAdmin.from("prime_contract_payment_applications").delete().eq("contract_id", contractId);

  await supabaseAdmin.from("contract_line_items").delete().eq("contract_id", contractId);
  await supabaseAdmin.from("prime_contracts").delete().eq("id", contractId);
}
