"use client";

import { useCallback, useEffect, useRef } from "react";

type Provider = "html5" | "youtube" | "vimeo" | "loom";
type Props = { contentItemId: string; title: string; url: string; provider: Provider };
const SESSION_KEY = "alleato.app-usage-session-id";

function checkpoint(position: number, duration: number) {
  if (!duration || duration <= 0) return 0 as const;
  const percent = (position / duration) * 100;
  if (percent >= 90) return 90 as const;
  if (percent >= 75) return 75 as const;
  if (percent >= 50) return 50 as const;
  if (percent >= 25) return 25 as const;
  return 0 as const;
}

function appSessionId() { return window.sessionStorage.getItem(SESSION_KEY) ?? undefined; }

export function TrackedVideoPlayer({ contentItemId, title, url, provider }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastPosition = useRef(0);
  const sent = useRef(new Set<number>());
  const report = useCallback((position: number, duration: number, force = false) => {
    const nextCheckpoint = checkpoint(position, duration);
    const watchedSeconds = Math.max(0, Math.min(120, position - lastPosition.current));
    lastPosition.current = position;
    if (!force && watchedSeconds < 10 && sent.current.has(nextCheckpoint)) return;
    sent.current.add(nextCheckpoint);
    void fetch("/api/engagement/learning-progress", {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ contentItemId, checkpoint: nextCheckpoint, positionSeconds: position, watchedSeconds, appSessionId: appSessionId() }),
    });
  }, [contentItemId]);

  useEffect(() => {
    if (provider === "html5") return;
    const allowedOrigins = provider === "youtube"
      ? new Set(["https://www.youtube.com", "https://www.youtube-nocookie.com"])
      : provider === "vimeo"
        ? new Set(["https://player.vimeo.com"])
        : new Set(["https://www.loom.com", "https://www.useloom.com"]);
    const iframe = iframeRef.current;
    if (provider === "vimeo" && iframe) {
      const subscribe = (value: string) => iframe.contentWindow?.postMessage({ method: "addEventListener", value }, "https://player.vimeo.com");
      const subscribeAfterLoad = () => ["play", "timeupdate", "ended"].forEach(subscribe);
      iframe.addEventListener("load", subscribeAfterLoad, { once: true });
      subscribeAfterLoad();
    }
    if (provider === "loom" && iframe) {
      const subscribe = (value: string) => iframe.contentWindow?.postMessage({ method: "addEventListener", value, context: "player.js" }, "https://www.loom.com");
      const subscribeAfterLoad = () => ["play", "timeupdate", "ended"].forEach(subscribe);
      iframe.addEventListener("load", subscribeAfterLoad, { once: true });
      subscribeAfterLoad();
    }
    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      let data: unknown = event.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== "object") return;
      const message = data as { event?: string; data?: unknown; value?: unknown; info?: { currentTime?: number; duration?: number }; currentTime?: number; duration?: number };
      const details = (message.data && typeof message.data === "object" ? message.data : message.value && typeof message.value === "object" ? message.value : message) as { seconds?: number; duration?: number; currentTime?: number };
      const position = details.seconds ?? details.currentTime ?? message.info?.currentTime;
      const duration = details.duration ?? message.info?.duration;
      if (message.event === "play" || message.event === "onStateChange" && message.data === 1) report(0, 0, true);
      if (typeof position === "number" && typeof duration === "number") report(position, duration);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [provider, report]);

  useEffect(() => {
    if (provider !== "youtube") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    type YouTubePlayer = { getCurrentTime: () => number; getDuration: () => number; destroy: () => void };
    type YouTubeWindow = Window & { YT?: { Player: new (element: HTMLIFrameElement, options: { events: { onStateChange: (event: { data: number; target: YouTubePlayer }) => void } }) => YouTubePlayer } };
    let player: YouTubePlayer | null = null;
    let timer: number | null = null;
    const start = () => { if (timer === null) timer = window.setInterval(() => player && report(player.getCurrentTime(), player.getDuration()), 10_000); };
    const stop = () => { if (timer !== null) { window.clearInterval(timer); timer = null; } };
    const initialize = () => {
      const YT = (window as YouTubeWindow).YT;
      if (!YT?.Player || player) return;
      player = new YT.Player(iframe, { events: { onStateChange: ({ data, target }) => {
        if (data === 1) { report(target.getCurrentTime(), target.getDuration(), true); start(); }
        if (data === 0) { report(target.getDuration(), target.getDuration(), true); stop(); }
        if (data === 2) stop();
      } } });
    };
    const existing = document.querySelector('script[data-alleato-youtube-api="true"]');
    if (existing) { existing.addEventListener("load", initialize, { once: true }); initialize(); }
    else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.dataset.alleatoYoutubeApi = "true";
      script.addEventListener("load", initialize, { once: true });
      document.head.appendChild(script);
    }
    return () => { stop(); player?.destroy(); };
  }, [provider, report]);

  if (provider === "html5") {
    return <video controls preload="metadata" className="h-full w-full" onPlay={() => report(0, 0, true)} onTimeUpdate={(event) => report(event.currentTarget.currentTime, event.currentTarget.duration)} onEnded={(event) => report(event.currentTarget.duration, event.currentTarget.duration, true)}><source src={url} /></video>;
  }
  return <iframe ref={iframeRef} src={url} title={title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="eager" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />;
}
