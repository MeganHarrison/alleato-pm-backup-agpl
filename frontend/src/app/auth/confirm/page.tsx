import { ConfirmClient } from "@/components/misc/confirm-client";

interface PageProps {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}

/**
 * Email-link confirmation page (invite / recovery / magic-link).
 *
 * This intentionally does NOT verify the one-time token on GET. Inbound mail
 * scanners — notably Microsoft Defender Safe Links on @alleatogroup.com — pre-fetch
 * every URL in an email, which would consume a verify-on-GET token before the
 * recipient ever clicks. Instead the token is verified client-side only when a
 * human loads the page and clicks "Continue", so a plain scanner GET (no JS,
 * no click) leaves the token intact.
 */
export default async function Page({ searchParams }: PageProps) {
  const { token_hash, type, next } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ConfirmClient
          tokenHash={token_hash ?? null}
          type={type ?? null}
          next={next ?? "/"}
        />
      </div>
    </div>
  );
}
