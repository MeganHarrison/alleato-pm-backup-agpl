import { LoginPageV3 } from "@/components/misc/login-page-v3";
import { validateCallbackUrl } from "@/lib/validation/callback-url";

export default async function LoginV3Page({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = validateCallbackUrl(params.callbackUrl);
  return <LoginPageV3 redirectTo={redirectTo} />;
}
