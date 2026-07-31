/**
 * Normalize numbered meeting/action summaries into a clearer layout:
 * "1. **Meeting Name** - details" => "### 1. Meeting Name\n\ndetails"
 */
function normalizeRetrievedSnippetLine(line: string): string {
  const indentationMatch = line.match(/^\s+/);
  if (!indentationMatch) return line;

  const trimmed = line.trim();
  if (!trimmed.startsWith("#")) return line;

  return `${indentationMatch[0]}${trimmed.replace(/^#{1,6}\s+/, "")}`;
}

function normalizeInlineMarkdownBlocks(text: string): string {
  return text
    .replace(/\s+(#{2,4}\s+\d+\.)/g, "\n\n$1")
    .replace(
      /^(#{2,4}\s+\d+\.\s+[^#\n]{8,90}?)\s+(I can|I'll|I’ll|I will|Use this|Ask me|Examples?:)/gm,
      "$1\n\n$2",
    )
    .replace(/:\s+-\s+/g, ":\n- ");
}

function normalizeInlineBulletLists(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trimStart().startsWith("- ") || !line.includes(" - ")) {
        return line;
      }

      const indent = line.match(/^\s*/)?.[0] ?? "";
      const items = line
        .trim()
        .replace(/^-\s+/, "")
        .split(/\s+-\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (items.length < 2) return line;
      return items.map((item) => `${indent}- ${item}`).join("\n");
    })
    .join("\n");
}

export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[\-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^[-_*]{3,}$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatStructuredMeetingList(text: string): string {
  const normalizedText = normalizeInlineBulletLists(
    normalizeInlineMarkdownBlocks(text),
  );

  if (!normalizedText.includes("\n") || !normalizedText.includes("1.")) {
    return normalizedText;
  }

  const lines = normalizedText.split("\n");
  const linePattern =
    /^(\d+)\.\s*(?:\*\*([^*]+)\*\*|([^—–:\-]+))\s*[—–:\-]\s*(.+)$/;

  const matches = lines
    .map((line, index) => ({ line, index, match: line.match(linePattern) }))
    .filter((item) => item.match);

  // Only transform when this really looks like a meeting/results list.
  if (matches.length < 2) return normalizedText;

  return lines
    .map((line) => {
      const match = line.match(linePattern);
      if (!match) return normalizeRetrievedSnippetLine(line);
      const num = match[1];
      const title = (match[2] ?? match[3] ?? "").trim();
      const description = match[4].trim();
      return `### ${num}. ${title}\n\n${description}`;
    })
    .join("\n\n");
}
