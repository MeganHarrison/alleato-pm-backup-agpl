type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let cachedConfig: SupabaseConfig | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  const missingVars: string[] = [];
  if (!url) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  if (!anonKey) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  }

  if (missingVars.length) {
    throw new Error(
      `Missing Supabase environment variables: ${missingVars.join(
        ", ",
      )}. Please update your .env/.env.local files.`,
    );
  }

  cachedConfig = {
    url: url!,
    anonKey: anonKey!,
  };

  return cachedConfig;
}
