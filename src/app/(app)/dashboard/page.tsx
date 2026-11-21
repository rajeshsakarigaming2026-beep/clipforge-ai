import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Plus, Clapperboard, FolderOpen, Activity, ArrowUpRight, Sparkles, Clock } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { CLOUD_APP_URL } from "@/lib/site";
import { accessLabel, hasPaidAccess } from "@/lib/access";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const h = await headers();
  const hostname = h.get("x-forwarded-host") || h.get("host") || "";
  const hosted = process.env.NEXT_PUBLIC_HOSTED_MODE === "true" || hostname.includes("vercel.app");
  const [projects, clipCount, settings] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { clips: true } } } }),
    prisma.clip.count({ where: { project: { userId: user.id } } }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);
  const totalMinutes = projects.reduce((sum, p) => sum + (p.duration || 0), 0) / 60;
  const stats = [
    { label: "Clips generated", value: clipCount, icon: Clapperboard, color: "from-violet-500 to-fuchsia-500" },
    { label: "Projects", value: projects.length, icon: FolderOpen, color: "from-blue-500 to-cyan-400" },
    { label: "Video analyzed", value: `${Math.round(totalMinutes)}m`, icon: Clock, color: "from-fuchsia-500 to-pink-500" },
    { label: "Active jobs", value: projects.filter((p) => p.status === "processing").length, icon: Activity, color: "from-emerald-500 to-teal-400" },
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Workspace</p><h1 className="mt-2 text-3xl font-bold text-white">Good to see you, {user.name.split(" ")[0]}</h1><p className="mt-1.5 text-sm text-slate-400">Here&apos;s what your video pipeline has been up to.</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${hasPaidAccess(settings) ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400"}`}>{accessLabel(settings)}</span></div>
        {!hosted && <Link href="/projects/new" className="btn-primary"><Plus className="h-4 w-4" /> New project</Link>}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass card-hover rounded-2xl p-5">
            <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}><stat.icon className="h-5 w-5" /></div>
            <p className="mt-4 text-3xl font-bold text-white">{stat.value}</p><p className="mt-1 text-xs font-medium text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Recent projects</h2><p className="text-xs text-slate-500">Your latest work</p></div><Link href="/projects" className="flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
          {projects.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-14 text-center"><FolderOpen className="h-8 w-8 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No projects yet</p><p className="mt-1 text-xs text-slate-500">Upload a video or paste a link to get started.</p>{hosted ? <a href={`${CLOUD_APP_URL}/projects/new`} className="btn-primary mt-5 !py-2 !text-xs">Open full app</a> : <Link href="/projects/new" className="btn-primary mt-5 !py-2 !text-xs">Create your first project</Link>}
</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3 font-medium">Project</th><th className="pb-3 font-medium">Created</th><th className="pb-3 font-medium">Clips</th><th className="pb-3 font-medium">Status</th><th className="pb-3" /></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {projects.slice(0, 6).map((project) => (
                    <tr key={project.id} className="group">
                      <td className="py-3.5"><Link href={project.status === "completed" ? `/projects/${project.id}/clips` : `/projects/${project.id}/process`} className="font-medium text-slate-200 transition group-hover:text-white">{project.name}</Link><p className="text-[11px] text-slate-500">{project.topic} · {project.sourceType === "url" ? "URL" : "Upload"}</p></td>
                      <td className="py-3.5 text-xs text-slate-400">{new Date(project.createdAt).toLocaleDateString()}</td>
                      <td className="py-3.5 text-xs text-slate-300">{project._count.clips}</td>
                      <td className="py-3.5"><StatusBadge status={project.status} /></td>
                      <td className="py-3.5 text-right"><Link href={project.status === "completed" ? `/projects/${project.id}/clips` : `/projects/${project.id}/process`} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"><ArrowUpRight className="h-4 w-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/20 to-blue-700/10 p-6">
            <Sparkles className="h-6 w-6 text-violet-200" /><h3 className="mt-4 text-lg font-semibold text-white">Turn a stream into clips</h3><p className="mt-2 text-sm leading-relaxed text-slate-300/80">Paste a video link or upload a recording. CLIPFORGE finds the highlights and renders vertical shorts — captions, facecam and all.</p>{hosted ? <a href={`${CLOUD_APP_URL}/projects/new`} className="btn-primary mt-5 w-full !py-2.5 !text-xs">Open full app <ArrowUpRight className="h-3.5 w-3.5" /></a> : <Link href="/projects/new" className="btn-primary mt-5 w-full !py-2.5 !text-xs">Start a project <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          </div>
          <div className="glass rounded-2xl p-6"><h3 className="text-sm font-semibold text-white">Pipeline health</h3><div className="mt-4 space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-slate-400">Local storage</span><span className="text-emerald-300">● Active</span></div><div className="flex items-center justify-between"><span className="text-slate-400">FFmpeg renderer</span><span className="text-emerald-300">● Ready</span></div><div className="flex items-center justify-between"><span className="text-slate-400">Speech-to-text</span><span className="text-emerald-300">● Local</span></div></div><p className="mt-4 text-[11px] leading-relaxed text-slate-500">Processing runs on this machine. Check Settings for storage and provider configuration.</p></div>
        </div>
      </div>
      <p className="mt-8 text-center text-[11px] text-slate-600">Total source time analyzed: {formatDuration(totalMinutes)}</p>
    </div>
  );
}
