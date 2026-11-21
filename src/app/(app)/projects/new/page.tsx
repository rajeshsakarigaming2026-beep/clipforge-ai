"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Link2, UploadCloud, FileVideo, Check, Loader2, ArrowRight, Video, ImageIcon, Clock, Info, ShieldCheck } from "lucide-react";
import { isSupportedUrl } from "@/lib/utils";
import { CLOUD_APP_URL } from "@/lib/site";

type Meta = { title: string; channel: string; duration: number; thumbnail: string | null; live: boolean; platform: string };

export default function NewProjectPage() {
  const router = useRouter();
  const [hosted, setHosted] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("gaming");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [localMeta, setLocalMeta] = useState<{ duration: number; thumb: string | null } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setHosted(process.env.NEXT_PUBLIC_HOSTED_MODE === "true" || window.location.hostname.endsWith(".vercel.app"));
  }, []);

  async function fetchMeta() {
    setError(""); setMeta(null);
    if (hosted) { setError("Open the local CLIPFORGE app to read video links and render clips."); return; }
    if (!isSupportedUrl(url)) { setError("Use a supported Video, Twitch, Kick or Vimeo URL."); return; }
    setBusy("meta");
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not fetch details");
      setMeta(data);
      if (!name) setName(data.title);
    } catch (err) { setError("Details unavailable, but you can still generate clips. " + (err instanceof Error ? err.message.slice(0, 160) : ""));
      if (!name) setName(url.slice(0, 80));
    }
    finally { setBusy(""); }
  }

  function selectFile(candidate?: File | null) {
    if (!candidate) return;
    setError(""); setFile(candidate); setMeta(null);
    if (!name) setName(candidate.name.replace(/\.[^.]+$/, ""));
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(candidate);
    video.onloadedmetadata = () => {
      const time = Math.min(2, video.duration / 2);
      const canvas = document.createElement("canvas");
      video.currentTime = time;
      video.onseeked = () => {
        canvas.width = 160; canvas.height = 90;
        canvas.getContext("2d")?.drawImage(video, 0, 0, 160, 90);
        setLocalMeta({ duration: video.duration, thumb: canvas.toDataURL("image/jpeg", 0.7) });
      };
    };
    video.onerror = () => setLocalMeta({ duration: 0, thumb: null });
  }

  async function create() {
    setError("");
    if (hosted) { setError("Open the local CLIPFORGE app to create and render projects."); return; }
    if (mode === "url" && !isSupportedUrl(url)) { setError("Enter a supported video URL."); return; }
    if (mode === "upload" && !file) { setError("Choose a video file first."); return; }
    if (name.trim().length < 2) { setError("Give the project a name."); return; }
    setBusy("create");
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, topic, sourceType: mode, sourceUrl: mode === "url" ? url : undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project");
      const id = data.project.id as string;
      if (mode === "upload" && file) {
        const form = new FormData(); form.append("file", file);
        const up = await fetch(`/api/projects/${id}/upload`, { method: "POST", body: form });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error || "Upload failed");
      }
      const start = await fetch(`/api/projects/${id}/process`, { method: "POST" });
      if (!start.ok) { const err = await start.json().catch(() => ({})); throw new Error(err.error || "Could not start processing"); }
      router.push(`/projects/${id}/process`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy("");
    }
  }

  const ready = !hosted && (mode === "url" ? !!meta : !!file);

  return (
    <div>
      <button onClick={() => router.back()} className="inline-flex min-h-10 items-center py-2 text-xs text-slate-400 transition hover:text-white">← Back</button>
      {hosted && <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-200"><p className="font-semibold">This website is the public demo.</p><p className="mt-1 text-xs text-violet-200/80">Create projects and render clips on the full CLIPFORGE app: <a href={CLOUD_APP_URL} className="font-semibold underline">{CLOUD_APP_URL}</a></p></div>}
      <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">New project</p><h1 className="mt-2 text-3xl font-bold text-white">Create viral clips</h1><p className="mt-1 text-sm text-slate-400">Bring a long video. We&apos;ll find the moments and render the shorts.</p></div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">1. Choose your source</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {([{ key: "url", icon: Link2, title: "Video URL", text: "Video, Twitch, Kick…" }, { key: "upload", icon: UploadCloud, title: "Upload file", text: "MP4, MOV, MKV, WebM" }] as const).map((item) => (
                <button key={item.key} onClick={() => { setMode(item.key); setError(""); }} disabled={hosted} className={`rounded-xl border p-4 text-left transition ${mode === item.key ? "border-violet-400/50 bg-violet-500/10 shadow-glow" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
                  <item.icon className={`h-5 w-5 ${mode === item.key ? "text-violet-300" : "text-slate-400"}`} />
                  <p className="mt-3 text-sm font-semibold text-white">{item.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.text}</p>
                </button>
              ))}
            </div>

            {mode === "url" ? (
              <div className="mt-5">
                <label className="label">Video link</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={url} onChange={(e) => { setUrl(e.target.value); setMeta(null); }} placeholder="https://www.Video.com/watch?v=…" className="input" disabled={hosted} />
                  <button onClick={fetchMeta} disabled={hosted || busy === "meta"} className="btn-secondary shrink-0 !text-xs">{busy === "meta" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Fetch details</button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Public, accessible or recorded videos. Live streams are recorded from the start when possible. We never bypass logins or DRM.</p>
              </div>
            ) : (
              <div className="mt-5">
                <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} />
                <button onClick={() => fileInput.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); selectFile(e.dataTransfer.files?.[0]); }} disabled={hosted} className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-10 text-center transition ${drag ? "border-violet-400 bg-violet-500/10" : "border-white/10 hover:border-violet-400/40"}`}>
                  <UploadCloud className="h-8 w-8 text-violet-300" />
                  <p className="mt-3 text-sm font-semibold text-white">{file ? file.name : "Drop your video here"}</p>
                  <p className="mt-1 text-xs text-slate-500">{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · click to replace` : "or click to browse · up to 2 GB"}</p>
                </button>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">2. Project details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className="label">Project name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday stream highlights" /></div>
              <div><label className="label">Topic / focus</label><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="gaming, podcast, chess…" /></div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">The topic helps the highlight picker favour the right kind of moments. Number of clips is set in Settings.</p>
          </div>

          {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <button onClick={create} disabled={!ready || busy === "create"} className="btn-primary w-full !py-4">
            {busy === "create" ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating project…</> : <>Generate Clips <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>

        <div className="glass h-fit rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Source preview</h2>
          {!ready ? (
            <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-white/10 py-16 text-center"><ImageIcon className="h-8 w-8 text-slate-600" /><p className="mt-3 text-xs text-slate-500">Details appear here once a source is ready</p></div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              {(meta?.thumbnail || localMeta?.thumb) && <div role="img" aria-label="Source preview" className="aspect-video w-full rounded-xl border border-white/10 bg-cover bg-center" style={{ backgroundImage: `url("${(meta?.thumbnail || localMeta?.thumb || "").replace(/"/g, "")}")` }} />}
              <h3 className="mt-4 text-sm font-semibold leading-snug text-white">{meta?.title || file?.name}</h3>
              <p className="mt-1 text-xs text-slate-400">{meta?.channel || "Local file"}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3"><Clock className="h-3.5 w-3.5 text-violet-300" /><p className="mt-1 font-semibold text-white">{Math.round((meta?.duration || localMeta?.duration || 0) / 60)} min</p><p className="text-[10px] text-slate-500">Duration</p></div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3"><FileVideo className="h-3.5 w-3.5 text-blue-300" /><p className="mt-1 font-semibold text-white">{mode === "url" ? meta?.platform || "URL" : "Local"}</p><p className="text-[10px] text-slate-500">Source</p></div>
              </div>
              {meta?.live && <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-200">This stream is live. CLIPFORGE will record and analyze the opening segment.</div>}
            </motion.div>
          )}
          <div className="mt-6 rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-200"><Check className="h-3.5 w-3.5" /> What happens next</div>
            <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-400">
              <li>• Local Whisper transcription with word timings</li>
              <li>• Energy + speech + scene-change highlight scoring</li>
              <li>• 9:16 renders with facecam and captions</li>
              <li>• Preview, edit and download MP4s</li>
            </ul>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Use only content you are authorized to edit.</p>
        </div>
      </div>
    </div>
  );
}
