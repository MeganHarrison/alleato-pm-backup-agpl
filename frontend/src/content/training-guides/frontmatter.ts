// Minimal, dependency-free YAML-lite frontmatter parser for the training
// guides. Deliberately does not pull in gray-matter/next-mdx-remote -- this
// is a content-conversion ticket, not the MDX-compilation route wiring
// (that's a separate concern; see the content README).

export interface TrainingGuideFrontmatter {
  slug: string;
  title: string;
  description: string;
  roleIds: string[];
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const REQUIRED_STRING_FIELDS = ["slug", "title", "description"] as const;

function stripSurroundingQuotes(value: string): string {
  const isDoubleQuoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.length >= 2 && value.startsWith("'") && value.endsWith("'");
  if (isDoubleQuoted || isSingleQuoted) {
    return value.slice(1, -1);
  }
  return value;
}

function parseYamlLite(block: string): Record<string, string | string[]> {
  const lines = block.split(/\r?\n/);
  const fields: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const listItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (listItemMatch && currentListKey) {
      (fields[currentListKey] as string[]).push(listItemMatch[1].trim());
      continue;
    }

    const fieldMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!fieldMatch) {
      throw new Error(`Malformed frontmatter line (expected 'key: value' or a '- item' under a list key): '${line}'`);
    }
    const [, key, rawValue] = fieldMatch;

    if (rawValue === "" ) {
      fields[key] = [];
      currentListKey = key;
      continue;
    }

    if (rawValue === "[]") {
      fields[key] = [];
      currentListKey = null;
      continue;
    }

    fields[key] = stripSurroundingQuotes(rawValue.trim());
    currentListKey = null;
  }

  return fields;
}

export function parseGuideFrontmatter(source: string): {
  frontmatter: TrainingGuideFrontmatter;
  body: string;
} {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error("Guide source is missing a --- frontmatter block.");
  }

  const [, frontmatterBlock, body] = match;
  const fields = parseYamlLite(frontmatterBlock);

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof fields[field] !== "string" || !(fields[field] as string).trim()) {
      throw new Error(`Guide frontmatter is missing required field '${field}'.`);
    }
  }

  const roleIds = Array.isArray(fields.roleIds) ? fields.roleIds : [];

  return {
    frontmatter: {
      slug: fields.slug as string,
      title: fields.title as string,
      description: fields.description as string,
      roleIds,
    },
    body,
  };
}
