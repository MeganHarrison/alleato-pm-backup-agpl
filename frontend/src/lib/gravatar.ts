import { md5 } from "js-md5";

/**
 * Generate a Gravatar URL for an email address (server-side)
 * @param email - The email address
 * @param size - The size of the image (default: 200)
 * @param defaultImage - The default image type (404, mp, identicon, monsterid, wavatar, retro, robohash, blank)
 * @returns The Gravatar URL
 */
export function getGravatarUrl(
  email: string,
  size: number = 200,
  defaultImage: string = "mp", // Mystery Person default
): string {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = md5(trimmedEmail);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${defaultImage}`;
}

/**
 * Client-side Gravatar URL generator
 * Use this in client components
 */
export function getGravatarUrlClient(
  email: string,
  size: number = 200,
  defaultImage: string = "identicon", // Use identicon for better visual fallback
): string {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = md5(trimmedEmail);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${defaultImage}`;
}

/**
 * Get the best available avatar URL
 * Priority: custom avatar > Gravatar > initials fallback
 */
export function getBestAvatarUrl(
  customAvatar: string | undefined,
  email: string,
  size?: number,
): string | undefined {
  if (customAvatar) return customAvatar;
  if (email) return getGravatarUrlClient(email, size);
  return undefined;
}
