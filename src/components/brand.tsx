import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-blue-600 shadow-glow">
        <Clapperboard className="h-5 w-5 text-white transition-transform group-hover:scale-110" />
        <span className="absolute inset-0 animate-shimmer shimmer-bg" />
      </span>
      {!compact && (
        <span className="text-[17px] font-extrabold tracking-tight text-white">
          CLIPFORGE<span className="gradient-text"> AI</span>
        </span>
      )}
    </Link>
  );
}
