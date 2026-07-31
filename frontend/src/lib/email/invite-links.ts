import { APP_BASE_URL } from "./client";

export function buildAuthConfirmUrl(
  actionLink: string,
  type: "invite" | "recovery",
  next: string,
) {
  const actionUrl = new URL(actionLink);
  const token = actionUrl.searchParams.get("token");

  if (!token) {
    return actionLink;
  }

  return `${APP_BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}&next=${encodeURIComponent(next)}`;
}

export function buildInviteAcceptUrl(actionLink: string, email: string) {
  const passwordSetupUrl = `/auth/update-password?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/")}`;
  return buildAuthConfirmUrl(actionLink, "invite", passwordSetupUrl);
}

export function buildPasswordResetUrl(actionLink: string, email: string) {
  const passwordSetupUrl = `/auth/update-password?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/")}`;
  return buildAuthConfirmUrl(actionLink, "recovery", passwordSetupUrl);
}
