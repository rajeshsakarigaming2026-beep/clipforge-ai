import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { isSupportedUrl } from "@/lib/utils";
import { storage } from "@/lib/storage";

const exec = promisify(execFile);
export const runtime = "nodejs";

function ytDlp() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const local = path.join(home, ".streamclips", "venv", "Scripts", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.existsSync(local) ? local : "yt-dlp";
}

const MIRRORS = ["yt.chocolatemoo53.com", "inv.nadeko.net", "invidious.nerdvpn.de"];

type MirrorData = {
  title?: string;
  author?: string;
  lengthSeconds?: number;
  liveNow?: boolean;
  videoThumbnails?: { url?: string }[];
  adaptiveFormats?: { url?: string }[];
  formatStreams?: { url?: string }[];
};

function youtubeId(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0]?.slice(0, 11) || null;
    }
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const value = parsed.searchParams.get("v");
      if (value) return value.slice(0, 11);
      const match = parsed.pathname.match(/^\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})/);
      return match?.[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function mirrorMetadata(rawUrl: string): Promise<MirrorData | null> {
  const id = youtubeId(rawUrl);
  if (!id) return null;
  for (const host of MIRRORS) {
    try {
      const response = await fetch(`https://${host}/api/v1/videos/${id}?local=true`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as MirrorData;
      if (data.adaptiveFormats?.length || data.formatStreams?.length) return data;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestUrl = new URL(request.url);
  const hosted = process.env.NEXT_PUBLIC_HOSTED_MODE === "true" || requestUrl.hostname.endsWith(".vercel.app");
  if (hosted) {
    return NextResponse.json({ error: "Video processing is not available on the hosted website. Open the local CLIPFORGE app to read links and render clips." }, { status: 503 });
  }
  const url = requestUrl.searchParams.get("url") || "";
  if (!isSupportedUrl(url)) return NextResponse.json({ error: "Unsupported URL. Use YouTube, Twitch, Kick or Vimeo." }, { status: 400 });
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  const clients = isYouTube ? ["android_vr", "android", "tv", "mweb", "web_safari"] : [""];
  let cookieFile = process.env.YT_COOKIES_FILE;
  if (!cookieFile && isYouTube && await storage.exists("secrets/youtube-cookies.txt")) {
    cookieFile = await storage.localPath("secrets/youtube-cookies.txt");
  }
  let lastError = "Could not read video metadata";
  for (const client of clients) {
    try {
      const args = ["--no-playlist", "--no-warnings", "--socket-timeout", "10", "--retries", "1", "--skip-download"];
      if (client) args.push("--extractor-args", `youtube:player_client=${client}`);
      if (cookieFile) args.push("--cookies", cookieFile);
      const { stdout } = await exec(ytDlp(), [...args, "-J", url], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
      const data = JSON.parse(stdout);
      return NextResponse.json({
        title: data.title || "Untitled video",
        channel: data.channel || data.uploader || "Unknown creator",
        duration: Number(data.duration) || 0,
        thumbnail: data.thumbnail || null,
        live: Boolean(data.is_live),
        platform: new URL(url).hostname.replace(/^www\./, ""),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  if (isYouTube) {
    const mirror = await mirrorMetadata(url);
    if (mirror) {
      const thumbnail = mirror.videoThumbnails?.find((item) => item.url)?.url || null;
      return NextResponse.json({
        title: mirror.title || "Untitled video",
        channel: mirror.author || "Unknown creator",
        duration: Number(mirror.lengthSeconds) || 0,
        thumbnail,
        live: Boolean(mirror.liveNow),
        platform: new URL(url).hostname.replace(/^www\./, ""),
      });
    }
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (response.ok) {
        const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
        return NextResponse.json({
          title: data.title || "Untitled video",
          channel: data.author_name || "Unknown creator",
          duration: 0,
          thumbnail: data.thumbnail_url || null,
          live: false,
          platform: new URL(url).hostname.replace(/^www\./, ""),
        });
      }
    } catch {
      lastError = "YouTube metadata fallback unavailable";
    }
  }
  const hint = isYouTube && /sign in|not a bot/i.test(lastError)
    ? "YouTube is blocking this cloud IP. Try a different public link or retry later. "
    : "Could not read this video. It may be private, live, region-locked or require a login. ";
  return NextResponse.json({ error: `${hint}${lastError.slice(0, 400)}` }, { status: 422 });
}
