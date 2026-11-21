import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "clip";
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function providerFromUrl(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host.includes("youtube.") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("twitch.")) return "Twitch";
  if (host.includes("kick.")) return "Kick";
  return host;
}

export function isSupportedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, "");
    return (
      host.includes("youtube.") ||
      host.includes("youtu.be") ||
      host.includes("twitch.tv") ||
      host.includes("kick.com") ||
      host.includes("vimeo.com")
    );
  } catch {
    return false;
  }
}
