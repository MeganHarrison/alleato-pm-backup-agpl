export async function copyTextWithFallback(
  text: string,
): Promise<"clipboard" | "execCommand"> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Copy is only available in the browser.");
  }

  let clipboardError: unknown;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch (error) {
      clipboardError = error;
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();

    if (document.execCommand("copy")) {
      return "execCommand";
    }
  } finally {
    document.body.removeChild(textarea);
  }

  throw new Error(
    "The browser denied clipboard access. Select the content manually and copy it.",
    { cause: clipboardError },
  );
}

export function downloadTextFile({
  content,
  fileName,
  mimeType = "text/plain;charset=utf-8",
}: {
  content: string;
  fileName: string;
  mimeType?: string;
}): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Download is only available in the browser.");
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
