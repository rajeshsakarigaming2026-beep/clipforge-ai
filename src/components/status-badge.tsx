import { CheckCircle2, CircleAlert, CircleDashed, Loader2, XCircle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
    created: { label: "Ready", icon: CircleDashed, cls: "text-slate-300 bg-slate-500/10 border-slate-400/20" },
    processing: { label: "Processing", icon: Loader2, cls: "text-violet-300 bg-violet-500/10 border-violet-400/25" },
    completed: { label: "Completed", icon: CheckCircle2, cls: "text-emerald-300 bg-emerald-500/10 border-emerald-400/25" },
    failed: { label: "Failed", icon: XCircle, cls: "text-red-300 bg-red-500/10 border-red-400/25" },
    cancelled: { label: "Cancelled", icon: PauseCircle, cls: "text-amber-300 bg-amber-500/10 border-amber-400/25" },
  };
  const item = map[status] || { label: status, icon: CircleAlert, cls: "text-slate-300 bg-white/5 border-white/10" };
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", item.cls)}><item.icon className={cn("h-3 w-3", status === "processing" && "animate-spin")} />{item.label}</span>;
}
