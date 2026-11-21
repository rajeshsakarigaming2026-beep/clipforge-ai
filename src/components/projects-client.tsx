"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Plus, Pencil, Trash2, Play, ArrowUpRight, X, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { LogLine } from "@/lib/types";

export type ProjectRow = {
  id: string; name: string; topic: string; status: string; stage: string; progress: number;
  sourceType: string; fileName: string | null; sourceUrl: string | null; createdAt: string;
  errorMessage: string | null; logs: string; clips: { id: string }[];
};

export function ProjectsClient({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const filtered = projects.filter((p) => (p.name + p.topic).toLowerCase().includes(query.toLowerCase()));

  async function rename() {
    if (!editing) return;
    setBusy(editing.id);
    await fetch(`/api/projects/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy(null); setEditing(null); router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and all of its generated clips?")) return;
    setBusy(id);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setBusy(null); router.refresh();
  }

  async function retry(id: string) {
    setBusy(id); setError("");
    const res = await fetch(`/api/projects/${id}/process`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Could not start processing");
    setBusy(null);
    router.push(`/projects/${id}/process`);
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Library</p><h1 className="mt-2 text-3xl font-bold text-white">Projects</h1><p className="mt-1 text-sm text-slate-400">Every video you have processed, in one place.</p></div>
        <Link href="/projects/new" className="btn-primary"><Plus className="h-4 w-4" /> New project</Link>
      </div>
      {error && <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h2 className="text-lg font-semibold text-white">All projects</h2><p className="text-xs text-slate-500">{projects.length} total</p></div>
          <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="input !py-2 !pl-10" placeholder="Search projects…" /></div>
        </div>
        {filtered.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-16 text-center"><FolderOpen className="h-9 w-9 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">Nothing here yet</p><p className="mt-1 text-xs text-slate-500">Create a project to see it listed here.</p></div>
        ) : (
          <div className="grid min-w-0 gap-3">
            {filtered.map((project) => (
              <motion.div key={project.id} layout className="group flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-violet-400/25 hover:bg-white/[0.04] sm:flex-row sm:items-center">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/25 to-blue-500/20 text-violet-200"><FolderOpen className="h-5 w-5" /></div>
                <div className="min-w-0 max-w-full flex-1">
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden"><p className="min-w-0 truncate font-semibold text-white">{project.name}</p><StatusBadge status={project.status} /></div>
                  <p className="mt-1 max-w-full truncate text-xs text-slate-500">{project.sourceType === "url" ? project.sourceUrl : project.fileName} · {project.topic} · {new Date(project.createdAt).toLocaleString()}</p>
                  {project.status === "failed" && project.errorMessage && <p className="mt-1 max-w-full truncate text-xs text-red-300/80">{project.errorMessage}</p>}
                  {project.status === "processing" && <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all" style={{ width: `${project.progress}%` }} /></div>}
                </div>
                <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2">
                  <span className="mr-2 text-xs text-slate-500">{project.clips.length} clips</span>
                  {project.status === "completed" ? (
                    <Link href={`/projects/${project.id}/clips`} className="btn-secondary !px-3 !py-2 !text-xs"><ArrowUpRight className="h-3.5 w-3.5" /> Open</Link>
                  ) : project.status === "processing" ? (
                    <Link href={`/projects/${project.id}/process`} className="btn-secondary !px-3 !py-2 !text-xs"><Play className="h-3.5 w-3.5" /> Progress</Link>
                  ) : (
                    <button onClick={() => retry(project.id)} disabled={busy === project.id} className="btn-secondary !px-3 !py-2 !text-xs"><Play className="h-3.5 w-3.5" /> {busy === project.id ? "Starting…" : "Process"}</button>
                  )}
                  <button onClick={() => { setEditing(project); setName(project.name); }} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label="Rename"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(project.id)} disabled={busy === project.id} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
            <div className="glass-strong w-full max-w-sm rounded-2xl p-6">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Rename project</h3><button onClick={() => setEditing(null)} className="text-slate-500"><X className="h-4 w-4" /></button></div>
              <input className="input mt-5" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && rename()} />
              <div className="mt-5 flex gap-2"><button onClick={() => setEditing(null)} className="btn-secondary flex-1 !py-2 !text-xs">Cancel</button><button onClick={rename} disabled={busy === editing.id} className="btn-primary flex-1 !py-2 !text-xs">Save</button></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
