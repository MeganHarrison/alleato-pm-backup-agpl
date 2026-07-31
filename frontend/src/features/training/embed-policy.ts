export type TrainingEmbed = {
  provider: "youtube" | "vimeo" | "loom";
  url: string;
};

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export function resolveTrainingEmbed(
  candidate: string | null | undefined,
): TrainingEmbed | null {
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "www.youtube-nocookie.com"
  ) {
    const playlistId = url.searchParams.get("list");
    if (playlistId && SAFE_ID.test(playlistId)) {
      return {
        provider: "youtube",
        url: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&enablejsapi=1`,
      };
    }

    const videoId =
      host === "youtu.be"
        ? pathParts[0]
        : pathParts[0] === "embed"
          ? pathParts[1]
          : url.searchParams.get("v");
    if (!videoId || !SAFE_ID.test(videoId)) return null;
    return {
      provider: "youtube",
      url: `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`,
    };
  }

  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const videoId = pathParts[0];
    if (!videoId || !/^\d+$/.test(videoId)) return null;
    return {
      provider: "vimeo",
      url: `https://player.vimeo.com/video/${videoId}?api=1`,
    };
  }

  if (host === "player.vimeo.com" && pathParts[0] === "video") {
    const videoId = pathParts[1];
    if (!videoId || !/^\d+$/.test(videoId)) return null;
    return {
      provider: "vimeo",
      url: `https://player.vimeo.com/video/${videoId}?api=1`,
    };
  }

  if (
    (host === "loom.com" || host === "www.loom.com") &&
    (pathParts[0] === "share" || pathParts[0] === "embed")
  ) {
    const videoId = pathParts[1];
    if (!videoId || !SAFE_ID.test(videoId)) return null;
    return {
      provider: "loom",
      url: `https://www.loom.com/embed/${videoId}`,
    };
  }

  return null;
}
