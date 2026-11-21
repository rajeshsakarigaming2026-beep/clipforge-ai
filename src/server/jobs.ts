import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { safeJson, slugify } from "@/lib/utils";
import type { LogLine, WorkerProgress } from "@/lib/types";

type ActiveJob = { child: ChildProcess; startedAt: number };

const globalForJobs = globalThis as unknown as {
  clipforgeJobs?: Map<string, ActiveJob>;
  clipforgeQueue?: string[];
};

const jobs = (globalForJobs.clipforgeJobs ??= new Map());
const queue = (globalForJobs.clipforgeQueue ??= []);

function resolvePython() {
  if (process.env.VIDEO_PYTHON) return process.env.VIDEO_PYTHON;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    path.join(home, ".streamclips", "venv", "Scripts", "python.exe"),
    path.join(home, ".streamclips", "venv", "bin", "python"),
    "python3",
    "python",
  ];
  return candidates.find((candidate) => candidate.includes(path.sep) ? fsSyncExists(candidate) : true) || "python";
}

function fsSyncExists(target: string) {
  try {
    return existsSync(target);
  } catch {
    return false;
  }
}

function resolveYtDlp() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const local = path.join(home, ".streamclips", "venv", "Scripts", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  return fsSyncExists(local) ? local : "yt-dlp";
}

async function appendLog(projectId: string, message: string, stage: LogLine["stage"] = "info") {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { logs: true } });
  const lines = safeJson<LogLine[]>(project?.logs, []);
  lines.push({ time: new Date().toISOString(), stage, message: message.slice(0, 500) });
  await prisma.project.update({
    where: { id: projectId },
    data: { logs: JSON.stringify(lines.slice(-200)) },
  });
}

export async function markInterruptedJobs() {
  await prisma.project.updateMany({
    where: { status: "processing", stage: "queued" },
    data: { status: "failed", errorMessage: "Processing was interrupted by a server restart. Please retry." },
  });
}

export function activeJobCount() {
  return jobs.size;
}

export function isJobActive(projectId: string) {
  return jobs.has(projectId) || queue.includes(projectId);
}

export function startJob(projectId: string) {
  if (process.env.CLOUD_WORKER === "true") {
    void prisma.project.update({
      where: { id: projectId },
      data: { status: "processing", stage: "queued", progress: 0, errorMessage: null },
    });
    return;
  }
  if (jobs.has(projectId)) return;
  if (queue.includes(projectId)) return;
  const max = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 1));
  if (jobs.size >= max) {
    queue.push(projectId);
    void prisma.project.update({
      where: { id: projectId },
      data: { status: "processing", stage: "queued", progress: 0 },
    });
    return;
  }
  void runProjectJob(projectId);
}

export async function runProjectJob(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.status === "completed") return;
  const sourcePath = project.storagePath
    ? await storage.localPath(project.storagePath)
    : project.sourceUrl || "";
  if (!sourcePath) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "failed", errorMessage: "No source file or URL was provided." } });
    return;
  }
  const work = path.join(storage.root, "projects", projectId, "work");
  const outdir = path.join(storage.root, "projects", projectId, "clips");
  await fs.mkdir(work, { recursive: true });
  await fs.mkdir(outdir, { recursive: true });
  const settings = {
    scanModel: "tiny",
    captionColor: "#FFFFFF",
    highlightColor: "#FFD400",
    layout: "auto",
    fontFamily: "Arial Black",
    music: "",
  };
  const maxSourceSeconds = Math.max(30, Math.min(7200, Number(process.env.MAX_SOURCE_SECONDS || 1800) || 1800));

  const child = spawn(resolvePython(), [
    path.join(process.cwd(), "python", "cf_worker.py"),
    "--source", sourcePath,
    "--outdir", outdir,
    "--workdir", work,
    "--clips", String(Math.max(3, Math.min(6, await clipCount(project.userId)))),
    "--max-source-seconds", String(maxSourceSeconds),
    "--topic", project.topic,
    "--language", "auto",
    "--settings", JSON.stringify(settings),
    "--ffmpeg", process.env.FFMPEG_BIN || "ffmpeg",
    "--ffprobe", process.env.FFPROBE_BIN || "ffprobe",
    "--ytdlp", resolveYtDlp(),
  ], { cwd: process.cwd(), env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });

  jobs.set(projectId, { child, startedAt: Date.now() });
  await prisma.project.update({ where: { id: projectId }, data: { status: "processing", stage: "downloading", progress: 2, errorMessage: null } });
  await appendLog(projectId, "Worker started", "info");

  let buffer = "";
  let settled = false;

  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      if (!line.trim()) continue;
      try {
        void handleEvent(projectId, JSON.parse(line) as Record<string, unknown>);
      } catch {
        void appendLog(projectId, line.slice(0, 300));
      }
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    void appendLog(projectId, `stderr: ${chunk.toString("utf8").trim().slice(0, 400)}`);
  });
  child.on("error", (error) => {
    if (!settled) void fail(projectId, error.message);
  });
  child.on("close", (code) => {
    if (settled) return;
    settled = true;
    jobs.delete(projectId);
    const next = queue.shift();
    if (next) setTimeout(() => startJob(next), 200);
    if (code !== 0) {
      void prisma.project.update({
        where: { id: projectId },
        data: { status: "failed", stage: "failed", errorMessage: `Worker exited with code ${code}. Check the activity log.` },
      });
    }
  });
}

async function clipCount(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings?.clipsPerVideo || 3;
}

async function handleEvent(projectId: string, event: Record<string, unknown>) {
  if (event.type === "log") {
    await appendLog(projectId, String(event.message || ""));
    return;
  }
  if (event.type === "progress") {
    const p = event as unknown as WorkerProgress;
    await prisma.project.update({ where: { id: projectId }, data: { stage: p.stage, progress: p.progress } });
    await appendLog(projectId, p.message, p.stage);
    return;
  }
  if (event.type === "moments") {
    const clips = Array.isArray(event.clips) ? event.clips : [];
    await prisma.project.update({ where: { id: projectId }, data: { metadata: JSON.stringify({ moments: clips }) } });
    await appendLog(projectId, `Selected ${clips.length} highlight moment(s)`, "analyzing");
    return;
  }
  if (event.type === "error") {
    await fail(projectId, String(event.message || "Unknown worker error"));
    return;
  }
  if (event.type === "done") {
    const clips = Array.isArray(event.clips) ? event.clips : [];
    const outdir = path.join(storage.root, "projects", projectId, "clips");
    let created = 0;
    for (const item of clips as Record<string, unknown>[]) {
      const file = String(item.file || "");
      if (!file) continue;
      const thumb = item.thumb ? String(item.thumb) : null;
      await storage.write(`projects/${projectId}/clips/${file}`, await fs.readFile(path.join(outdir, file)));
      if (thumb) await storage.write(`projects/${projectId}/clips/${thumb}`, await fs.readFile(path.join(outdir, thumb)));
      const title = String(item.title || `Clip ${created + 1}`).replace(/^\d+\.\s*/, "");
      await prisma.clip.create({
        data: {
          projectId,
          title,
          slug: slugify(title),
          startTime: Number(item.startTime) || 0,
          endTime: Number(item.endTime) || 0,
          duration: Math.max(1, (Number(item.endTime) || 0) - (Number(item.startTime) || 0)),
          score: Number(item.score) || 60,
          reason: item.reason ? String(item.reason) : null,
          type: item.type ? String(item.type) : null,
          filePath: `projects/${projectId}/clips/${file}`,
          thumbPath: thumb ? `projects/${projectId}/clips/${thumb}` : null,
          look: item.look ? String(item.look) : "stack",
          transcript: JSON.stringify(Array.isArray(item.words) ? item.words : []),
          status: "ready",
        },
      });
      created += 1;
    }
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: created ? "completed" : "failed",
        stage: created ? "completed" : "failed",
        progress: created ? 100 : 0,
        duration: Number(event.duration) || null,
        errorMessage: created ? null : "The worker finished without producing any clips.",
      },
    });
    await appendLog(projectId, `Finished: ${created} clip(s) ready`, "finalizing");
  }
}

async function fail(projectId: string, message: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "failed", stage: "failed", errorMessage: message },
  });
  await appendLog(projectId, `Error: ${message}`, "failed");
}

export function cancelJob(projectId: string): boolean {
  const job = jobs.get(projectId);
  if (!job) return false;
  job.child.kill("SIGTERM");
  jobs.delete(projectId);
  void prisma.project.update({
    where: { id: projectId },
    data: { status: "cancelled", stage: "cancelled", errorMessage: "Processing was cancelled." },
  });
  return true;
}

export async function rerenderClip(
  projectId: string,
  clip: { id: string; filePath: string; title: string; startTime: number; endTime: number; transcript: string | null; camX: number; camY: number; camW: number; camH: number; zoom: number; playbackSpeed: number; captionColor: string; highlightColor: string; look: string },
  edits: Record<string, unknown>,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");
  const sourcePath = project.storagePath ? await storage.localPath(project.storagePath) : project.sourceUrl || "";
  if (!sourcePath) throw new Error("Source is unavailable");
  const work = path.join(storage.root, "projects", projectId, "work");
  const outdir = path.join(storage.root, "projects", projectId, "clips");
  await fs.mkdir(work, { recursive: true });
  const resultFile = `edited-${clip.id}.mp4`;
  const words = safeJson<{ s: number; e: number; w: string }[]>(clip.transcript, []);
  const existingWords = Array.isArray(words) ? words : [];
  const pick = {
    title: edits.title || clip.title,
    startTime: edits.startTime ?? clip.startTime,
    endTime: edits.endTime ?? clip.endTime,
    file: resultFile,
    layout: edits.layout || clip.look,
    camX: edits.camX ?? clip.camX,
    camY: edits.camY ?? clip.camY,
    camW: edits.camW ?? clip.camW,
    camH: edits.camH ?? clip.camH,
    zoom: edits.zoom ?? clip.zoom,
    playbackSpeed: edits.playbackSpeed ?? clip.playbackSpeed,
    captionColor: edits.captionColor || clip.captionColor,
    highlightColor: edits.highlightColor || clip.highlightColor,
    fontFamily: "Arial Black",
    words: existingWords,
  };
  const args = [
    path.join(process.cwd(), "python", "cf_worker.py"),
    "--source", sourcePath,
    "--outdir", outdir,
    "--workdir", work,
    "--rerender", JSON.stringify(pick),
    "--ffmpeg", process.env.FFMPEG_BIN || "ffmpeg",
    "--ffprobe", process.env.FFPROBE_BIN || "ffprobe",
    "--ytdlp", resolveYtDlp(),
    "--settings", JSON.stringify({ layout: pick.layout, captionColor: pick.captionColor, highlightColor: pick.highlightColor }),
  ];
  const child = spawn(resolvePython(), args, { cwd: process.cwd(), env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });
  const output = await new Promise<Record<string, unknown>>((resolve, reject) => {
    let buffer = "";
    let done: Record<string, unknown> | null = null;
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";
      for (const line of parts) {
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          if (event.type === "done") {
            const list = event.clips as Record<string, unknown>[] | undefined;
            done = (Array.isArray(list) ? list[0] : undefined) || event;
          }
          if (event.type === "error") reject(new Error(String(event.message)));
        } catch { /* ignore non-json */ }
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => { buffer += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !done) reject(new Error(`Render process exited with code ${code}: ${buffer.slice(-500)}`));
      else resolve(done || {});
    });
  });
  const thumb = output.thumb ? String(output.thumb) : null;
  await storage.write(`projects/${projectId}/clips/${resultFile}`, await fs.readFile(path.join(outdir, resultFile)));
  if (thumb) await storage.write(`projects/${projectId}/clips/${thumb}`, await fs.readFile(path.join(outdir, thumb)));
  await prisma.clip.update({
    where: { id: clip.id },
    data: {
      title: String(pick.title),
      startTime: Number(pick.startTime),
      endTime: Number(pick.endTime),
      duration: Math.max(1, Number(pick.endTime) - Number(pick.startTime)),
      filePath: `projects/${projectId}/clips/${resultFile}`,
      thumbPath: thumb ? `projects/${projectId}/clips/${thumb}` : null,
      camX: Number(pick.camX), camY: Number(pick.camY), camW: Number(pick.camW), camH: Number(pick.camH),
      zoom: Number(pick.zoom), playbackSpeed: Number(pick.playbackSpeed),
      captionColor: String(pick.captionColor), highlightColor: String(pick.highlightColor),
      look: String(pick.layout),
    },
  });
  return resultFile;
}

export async function runRenderJob(jobId: string) {
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return;
  const clip = await prisma.clip.findUnique({ where: { id: job.clipId } });
  if (!clip) {
    await prisma.renderJob.update({ where: { id: jobId }, data: { status: "failed", error: "Clip no longer exists" } });
    return;
  }
  try {
    await rerenderClip(clip.projectId, clip, safeJson<Record<string, unknown>>(job.payload, {}));
    await prisma.renderJob.update({ where: { id: jobId }, data: { status: "done", error: null } });
  } catch (error) {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "Render failed" },
    });
  }
}
