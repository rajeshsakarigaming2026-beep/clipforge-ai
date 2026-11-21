"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Download, Pencil, ArrowLeft, Sparkles, Clock, Gauge, Files, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export type ClipRow = {
  id: string; title: string; slug: string; startTime: number; endTime: number; duration: number;
  score: number; reason: string | null; type: string | null; look: string; thumbPath: string | null;
  captionColor: string; highlightColor: string; camX: number; camY: number; camW: number; camH: number;
  zoom: number; playbackSpeed: number;
};

export default function ClipsClient({ project, clips }: { project: { id: string; name: string; topic: string }; clips: ClipRow[] }) {
  const router = useRouter();
  async function remove(id: string) {
    if (!confirm("Delete this clip?")) return;
    await fetch(`/api/clips/${id}/file`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div>
      <Link href="/projects" className="text-xs text-slate-400 transition hover:text-white">← All projects</Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Generated clips</p><h1 className="mt-2 text-3xl font-bold text-white">{project.name}</h1><p className="mt-1 text-sm text-slate-400">{clips.length} vertical clips · topic: {project.topic}</p></div>
        <div className="flex gap-2">
          <Link href={`/api/projects/${project.id}/download-all`} className="btn-primary !py-2.5 !text-xs"><Files className="h-3.5 w-3.5" /> Download all (ZIP)</Link>
          <Link href={`/projects/${project.id}/process`} className="btn-secondary !py-2.5 !text-xs"><Sparkles className="h-3.5 w-3.5" /> Pipeline</Link>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="glass mt-8 grid place-items-center rounded-2xl border-dashed py-20 text-center"><Sparkles className="h-9 w-9 text-slate-600" /><p className="mt-4 text-sm font-semibold text-slate-300">No clips yet</p><p className="mt-1 text-xs text-slate-500">Process the project to generate vertical shorts.</p><Link href={`/projects/${project.id}/process`} className="btn-primary mt-5 !py-2 !text-xs">Go to processing</Link></div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((clip, i) => (
            <motion.div key={clip.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass card-hover group overflow-hidden rounded-2xl">
              <div className="relative aspect-[9/14] overflow-hidden bg-gradient-to-b from-violet-900/30 to-slate-950">
                <video src={`/api/clips/${clip.id}/file?inline=1`} poster={clip.thumbPath ? `/api/clips/${clip.id}/file?kind=thumb` : undefined} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                  <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">{clip.type || "highlight"}</span>
                  <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur">{clip.score} score</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-snug text-white">{clip.title}</h3>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(clip.startTime)} · {formatDuration(clip.duration)}</span><span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{clip.look}</span></div>
                {clip.reason && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{clip.reason}</p>}
                <div className="mt-4 flex gap-2">
                  <a href={`/api/clips/${clip.id}/file`} className="btn-secondary flex-1 !px-2 !py-2 !text-[11px]"><Download className="h-3.5 w-3.5" /> MP4</a>
                  <Link href={`/projects/${project.id}/editor/${clip.id}`} className="btn-primary flex-1 !px-2 !py-2 !text-[11px]"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                  <button onClick={() => remove(clip.id)} aria-label="Delete clip" className="rounded-lg border border-white/10 px-2 text-slate-500 transition hover:border-red-400/30 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
