"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, XCircle, ArrowRight, RotateCcw, Terminal, Sparkles, Clock, Trash2 } from "lucide-react";
import { STAGES, type LogLine } from "@/lib/types";
import { formatDuration, safeJson, cn } from "@/lib/utils";

type Props = {
  project: {
    id: string; name: string; topic: string; status: string; stage: string; progress: number;
    errorMessage: string | null; logs: string; metadata: string | null; duration: number | null;
  };
};

type Moment = { title: string; startTime: number; endTime: number; score: number; reason?: string; type?: string };

export default function ProcessClient({ project }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
  const [stage, setStage] = useState(project.stage);
  const [progress, setProgress] = useState(project.progress);
  const [logs, setLogs] = useState<LogLine[]>(safeJson<LogLine[]>(project.logs, []));
  const [error, setError] = useState(project.errorMessage);
  const [metadata, setMetadata] = useState(project.metadata);
  const [duration, setDuration] = useState(project.duration);
  const [busy, setBusy] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status); setStage(data.stage); setProgress(data.progress || 0);
      setLogs(data.logs || []); setError(data.errorMessage); setMetadata(data.metadata); setDuration(data.duration);
    } catch { /* retry */ }
  }, [project.id]);

  useEffect(() => {
    if (status !== "processing") return;
    const timer = setInterval(poll, 1200);
    return () => clearInterval(timer);
  }, [status, poll]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [logs.length]);

  async function retry() {
    setBusy(true);
    await fetch(`/api/projects/${project.id}/process`, { method: "POST" });
    setBusy(false); router.refresh(); poll();
  }
  async function cancel() {
    if (!confirm("Cancel processing this project?")) return;
    await fetch(`/api/projects/${project.id}/status`, { method: "DELETE" });
    poll();
  }
  async function remove() {
    if (!confirm("Delete this project permanently?")) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/projects"); router.refresh();
  }

  const moments = safeJson<{ moments: Moment[] }>(metadata, { moments: [] }).moments || [];
  const stageIndex = STAGES.findIndex((s) => s.key === stage);
  const done = status === "completed";
  const failed = status === "failed" || status === "cancelled";

  return (
    <div>
      <button onClick={() => router.push("/projects")} className="text-xs text-slate-400 transition hover:text-white">← All projects</button>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Processing</p><h1 className="mt-2 text-3xl font-bold text-white">{project.name}</h1><p className="mt-1 text-sm text-slate-400">Topic: {project.topic} · {duration ? formatDuration(duration) : "analyzing duration…"}</p></div>
        <div className="flex gap-2">
          {done && <Link href={`/projects/${project.id}/clips`} className="btn-primary !py-2.5 !text-xs">View clips <ArrowRight className="h-3.5 w-3.5" /></Link>}
          {failed && <button onClick={retry} disabled={busy} className="btn-primary !py-2.5 !text-xs"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>}
          {status === "processing" && <button onClick={cancel} className="btn-secondary !py-2.5 !text-xs">Cancel</button>}
          <button onClick={remove} className="rounded-xl border border-red-400/20 p-2.5 text-red-300/70 transition hover:bg-red-500/10 hover:text-red-300" aria-label="Delete project"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {error && <div className="mt-6 flex flex-wrap items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{error}</span>{/youtube|cookie|bot|blocked/i.test(error) && <Link href="/admin#youtube-cookies" className="shrink-0 font-semibold text-red-100 underline underline-offset-2">Open cookie settings</Link>}</div>}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="glass rounded-2xl p-5 sm:p-7">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Pipeline progress</h2>{failed ? <span className="font-mono text-sm text-red-300">Failed</span> : <span className="font-mono text-sm text-violet-300">{progress}%</span>}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500 shadow-glow" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} /></div>
          <div className="mt-8 space-y-1">
            {STAGES.map((item, index) => {
              const active = status === "processing" && stageIndex === index;
              const complete = done || stageIndex > index;
              return (
                <div key={item.key} className={cn("relative flex gap-4 rounded-xl p-4 transition", active && "bg-violet-500/[0.07]")}>
                  {index < STAGES.length - 1 && <span className={cn("absolute left-[27px] top-12 h-[calc(100%-16px)] w-px", complete ? "bg-violet-400/40" : "bg-white/10")} />}
                  <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-bold", complete ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" : active ? "border-violet-400/50 bg-violet-500/20 text-violet-200" : "border-white/10 bg-white/[0.03] text-slate-500")}>
                    {complete ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}
                  </div>
                  <div className="pt-1"><p className={cn("text-sm font-semibold", complete || active ? "text-white" : "text-slate-500")}>{item.label}</p><p className="mt-0.5 text-xs text-slate-500">{active ? logs[logs.length - 1]?.message || item.description : item.description}</p></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4 text-xs font-semibold text-slate-300"><Terminal className="h-4 w-4 text-violet-300" /> Activity log<span className="ml-auto font-normal text-slate-600">{logs.length} events</span></div>
            <div className="h-64 overflow-y-auto bg-black/20 p-4 font-mono text-[11px] leading-relaxed">
              {logs.length === 0 && <p className="text-slate-600">Waiting for the worker…</p>}
              {logs.map((line, i) => <div key={i} className="flex gap-2"><span className="shrink-0 text-slate-600">{new Date(line.time).toLocaleTimeString()}</span><span className={line.stage === "failed" ? "text-red-300" : line.stage === "analyzing" ? "text-fuchsia-300" : "text-slate-400"}>{line.message}</span></div>)}
              <div ref={logEnd} />
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-300" /><h2 className="text-sm font-semibold text-white">Selected moments</h2></div>
            {moments.length === 0 ? <p className="mt-4 text-xs text-slate-500">{status === "processing" ? "The AI is listening to your video…" : "No moments selected yet."}</p> : (
              <div className="mt-4 space-y-2">
                {moments.map((moment, i) => <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-200">{i + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{moment.title?.replace(/^\d+\.\s*/, "")}</p><p className="text-[10px] text-slate-500">{formatDuration(moment.startTime)} – {formatDuration(moment.endTime)} · {moment.type}</p></div><span className="text-xs font-bold text-emerald-300">{moment.score}</span></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
      {status === "processing" && <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> Live updates every second. You can leave this page; processing continues in the background.</p>}
    </div>
  );
}
