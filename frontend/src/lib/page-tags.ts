/**
 * Page tags — a small reusable catalog of tags that admins apply to routes from
 * the site map, plus the route↔tag assignments. Backed by `app_page_tags` and
 * `app_page_tag_assignments`. Used by the site map (tag column + create/apply UI)
 * and by curated tagged-page views such as Megan's Dashboard.
 */

/** Slug of the seeded curated-dashboard tag. Kept in sync with the migration. */
export const MEGANS_DASHBOARD_TAG_SLUG = "megans-dashboard";

export type PageTag = {
  slug: string;
  label: string;
  color: string | null;
  updatedAt: string | null;
};

export type PageTagAssignment = {
  route: string;
  tagSlug: string;
};

export type PageTagsResponse = {
  tags: PageTag[];
  assignments: PageTagAssignment[];
};

/**
 * Converts a free-text tag label into a stable kebab-case slug that satisfies
 * the `app_page_tags_slug_format_check` constraint (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
 * Returns an empty string when the label has no slug-able characters — callers
 * must treat that as invalid input.
 */
export function slugifyTagLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
