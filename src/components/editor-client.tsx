"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Wand2, Download, Loader2, Captions, LayoutGrid, SlidersHorizontal, Type, Clock, RotateCcw } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

export type EditorClip = {
  id: string; title: string; startTime: number; endTime: number; duration: number; transcript: string | null;
  captionColor: string; highlightColor: string; camX: number; camY: number; camW: number; camH: number;
  zoom: number; playbackSpeed: number; look: string; filePath: string;
};

type Word = { s: number; e: number; w: string };

export default function EditorClient({ projectId, clip }: { projectId: string; clip: EditorClip }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: clip.title,
    startTime: clip.startTime,
    endTime: clip.endTime,
    captionColor: clip.captionColor,
    highlightColor: clip.highlightColor,
    camX: clip.camX, camY: clip.camY, camW: clip.camW, camH: clip.camH,
    zoom: clip.zoom, playbackSpeed: clip.playbackSpeed, layout: clip.look,
  });
  const [tab, setTab] = useState<"captions" | "layout" | "timing">("captions");
  const [busy, setBusy] = useState<"save" | "render" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  const words = useMemo<Word[]>(() => {
    try {
      const parsed = JSON.parse(clip.transcript || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [clip.transcript]);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(render: boolean) {
    setBusy(render ? "render" : "save"); setError(""); setMessage("");
    try {
      if (render) {
        const res = await fetch(`/api/clips/${clip.id}/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Render failed");
        if (data.queued && data.jobId) {
          setMessage("Render queued — this can take a minute.");
          let finished = false;
          for (let i = 0; i < 180; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const poll = await fetch(`/api/render-jobs/${data.jobId}`);
            const status = await poll.json().catch(() => ({}));
            if (status.status === "done") { finished = true; break; }
            if (status.status === "failed") throw new Error(status.error || "Render failed");
          }
          if (!finished) throw new Error("Render is taking longer than expected. Check back shortly.");
        }
        setMessage("New MP4 rendered with your changes.");
        setVersion((v) => v + 1);
        router.refresh();
      } else {
        const res = await fetch(`/api/clips/${clip.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Save failed");
        setMessage("Edits saved to the project.");
        router.refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <Link href={`/projects/${projectId}/clips`} className="text-xs text-slate-400 transition hover:text-white">← Back to clips</Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Video editor</p><h1 className="mt-2 max-w-xl truncate text-2xl font-bold text-white sm:text-3xl">{clip.title}</h1><p className="mt-1 text-xs text-slate-400">Source segment: {formatDuration(clip.startTime)} – {formatDuration(clip.endTime)}</p></div>
        <div className="flex gap-2">
          <button onClick={() => save(false)} disabled={!!busy} className="btn-secondary !py-2.5 !text-xs"><Save className="h-3.5 w-3.5" /> {busy === "save" ? "Saving…" : "Save settings"}</button>
          <button onClick={() => save(true)} disabled={!!busy} className="btn-primary !py-2.5 !text-xs">{busy === "render" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {busy === "render" ? "Rendering…" : "Re-render MP4"}</button>
        </div>
      </div>
      {(message || error) && <div className={cn("mt-4 rounded-lg border px-4 py-3 text-sm", error ? "border-red-500/25 bg-red-500/10 text-red-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300")}>{error || message}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="glass rounded-2xl p-4">
            <video key={version} src={`/api/clips/${clip.id}/file?inline=1&v=${version}`} controls playsInline className="mx-auto aspect-[9/16] max-h-[65vh] rounded-xl bg-black object-contain" />
            <p className="mt-3 text-center text-[11px] text-slate-500">Preview plays the rendered MP4. Re-render to bake edits into the file.</p>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock className="h-4 w-4 text-violet-300" /> Timeline & trim</h2><span className="text-xs text-slate-400">{formatDuration(form.endTime - form.startTime)} output</span></div>
            <div className="mt-5 space-y-5">
              <div><label className="label">Start · {formatDuration(form.startTime)}</label><input type="range" min={0} max={Math.max(1, clip.endTime - 2)} step={0.1} value={Math.min(form.startTime, Math.max(1, clip.endTime - 2))} onChange={(e) => set("startTime", Math.min(Number(e.target.value), form.endTime - 1))} className="w-full accent-violet-500" /></div>
              <div><label className="label">End · {formatDuration(form.endTime)}</label><input type="range" min={Math.max(1, clip.startTime + 1)} max={Math.max(2, clip.endTime + 20)} step={0.1} value={form.endTime} onChange={(e) => set("endTime", Math.max(Number(e.target.value), form.startTime + 1))} className="w-full accent-blue-500" /></div>
              <div className="relative h-12 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-r from-violet-950/50 via-slate-900 to-blue-950/40">
                <div className="absolute inset-y-0 left-0 bg-white/5" style={{ width: `${Math.min(100, (form.startTime / Math.max(1, clip.endTime + 20)) * 100)}%` }} />
                <div className="absolute inset-y-0 rounded bg-violet-500/25 ring-1 ring-violet-400/40" style={{ left: `${(form.startTime / Math.max(1, clip.endTime + 20)) * 100}%`, width: `${Math.max(2, ((form.endTime - form.startTime) / Math.max(1, clip.endTime + 20)) * 100)}%` }} />
                <div className="absolute inset-0 grid place-items-center text-[10px] font-semibold tracking-wider text-white/60">OUTPUT REGION</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Captions className="h-4 w-4 text-violet-300" /> Transcript</h2>
            {words.length === 0 ? <p className="mt-3 text-xs text-slate-500">Word timings were not stored for this clip.</p> : (
              <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-relaxed">
                {words.map((word, i) => <span key={i} className="rounded px-1 py-0.5" style={{ color: form.captionColor, background: `${form.highlightColor}1f` }}>{word.w}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="glass h-fit rounded-2xl p-5">
          <div className="mb-5 flex gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
            {([{ key: "captions", icon: Type, label: "Captions" }, { key: "layout", icon: LayoutGrid, label: "Layout" }, { key: "timing", icon: SlidersHorizontal, label: "Motion" }] as const).map((item) => (
              <button key={item.key} onClick={() => setTab(item.key)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition", tab === item.key ? "bg-violet-500/20 text-violet-200" : "text-slate-500 hover:text-slate-300")}><item.icon className="h-3.5 w-3.5" />{item.label}</button>
            ))}
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {tab === "captions" && (
              <div className="space-y-5">
                <div><label className="label">Clip title</label><textarea value={form.title} onChange={(e) => set("title", e.target.value.slice(0, 120))} rows={2} className="input resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Caption color</label><input type="color" value={form.captionColor} onChange={(e) => set("captionColor", e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" /></div>
                  <div><label className="label">Highlight word</label><input type="color" value={form.highlightColor} onChange={(e) => set("highlightColor", e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" /></div>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-center"><p className="text-sm font-bold" style={{ color: form.captionColor }}>THIS MOMENT WAS <span style={{ color: form.highlightColor }}>UNREAL</span></p></div>
                <p className="text-[11px] leading-relaxed text-slate-500">Captions are rendered word-by-word with the highlighted color on the active word.</p>
              </div>
            )}
            {tab === "layout" && (
              <div className="space-y-5">
                <div><label className="label">Layout style</label><select value={form.layout} onChange={(e) => set("layout", e.target.value)} className="input"><option value="auto">Auto (detected)</option><option value="stack">Facecam on top</option><option value="crop">Follow face</option><option value="blur">Blurred backdrop</option></select></div>
                {([{ key: "camX", label: "Facecam X", max: 1 }, { key: "camY", label: "Facecam Y", max: 1 }, { key: "camW", label: "Facecam width", max: 1 }, { key: "camH", label: "Facecam height", max: 1 }] as const).map((slider) => (
                  <div key={slider.key}><label className="label">{slider.label} · {form[slider.key].toFixed(2)}</label><input type="range" min={0} max={slider.max} step={0.01} value={form[slider.key]} onChange={(e) => set(slider.key, Number(e.target.value))} className="w-full accent-violet-500" /></div>
                ))}
                <button onClick={() => setForm((f) => ({ ...f, camX: 0.72, camY: 0, camW: 0.28, camH: 0.3 }))} className="btn-secondary w-full !py-2 !text-xs"><RotateCcw className="h-3.5 w-3.5" /> Reset facecam</button>
              </div>
            )}
            {tab === "timing" && (
              <div className="space-y-5">
                <div><label className="label">Zoom · {form.zoom.toFixed(2)}×</label><input type="range" min={1} max={2} step={0.05} value={form.zoom} onChange={(e) => set("zoom", Number(e.target.value))} className="w-full accent-violet-500" /></div>
                <div><label className="label">Playback speed · {form.playbackSpeed.toFixed(2)}×</label><input type="range" min={0.5} max={2} step={0.05} value={form.playbackSpeed} onChange={(e) => set("playbackSpeed", Number(e.target.value))} className="w-full accent-blue-500" /></div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-slate-400"><p className="font-semibold text-white">Output settings</p><p className="mt-2">1080 × 1920 · H.264 / AAC · -14 LUFS · 30 fps</p><p className="mt-1">All edits are baked in when you re-render.</p></div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-600"><Download className="h-3.5 w-3.5" /> Re-rendering replaces this clip&apos;s MP4 in your project.</p>
    </div>
  );
}
