import "server-only";
import { redirect } from "next/navigation";
import { getApiRouteUser } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/owner";

/**
 * Server-side route guard: allows only the workspace owner through.
 *
 * Use in a route-segment `layout.tsx` (or server page) to lock an entire
 * surface to the owner. Non-owners are redirected to access-denied; logged-out
 * users to login. Because a layout's guard runs before the page renders,
 * wrapping a route in an owner-only layout prevents the page — client or
 * server — from rendering or fetching for anyone but the owner.
 */
export async function requireOwner(): Promise<void> {
  const user = await getApiRouteUser();
  if (!user) {
    redirect("/auth/login");
  }
  if (!isOwnerEmail(user.email)) {
    redirect("/access-denied?reason=owner-only");
  }
}

/**
 * Like {@link requireOwner}, but additionally lets a short allow-list of named
 * accounts through. Use for an owner-locked surface that one or two specific
 * users legitimately need (e.g. the subject of a personalized AI tool reviewing
 * their own feedback). The allow-list is matched case-insensitively. Every other
 * owner-only surface keeps using `requireOwner` — this does not widen them.
 */
export async function requireOwnerOrEmails(allowedEmails: string[]): Promise<void> {
  const user = await getApiRouteUser();
  if (!user) {
    redirect("/auth/login");
  }
  const email = user.email?.trim().toLowerCase() ?? "";
  const isAllowed =
    isOwnerEmail(user.email) ||
    allowedEmails.some((allowed) => allowed.trim().toLowerCase() === email);
  if (!isAllowed) {
    redirect("/access-denied?reason=owner-only");
  }
}
