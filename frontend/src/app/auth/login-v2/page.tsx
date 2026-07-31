import { LoginPageV2 } from "@/components/misc/login-page-v2";
import { validateCallbackUrl } from "@/lib/validation/callback-url";

export default async function LoginPageV2Route({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = validateCallbackUrl(params.callbackUrl);
  return <LoginPageV2 redirectTo={redirectTo} />;
}
