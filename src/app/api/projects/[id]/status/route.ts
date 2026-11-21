import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelJob, isJobActive } from "@/server/jobs";
import { safeJson } from "@/lib/utils";
import type { LogLine } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.status === "processing" && process.env.CLOUD_WORKER !== "true" && !isJobActive(id)) {
    await prisma.project.update({
      where: { id },
      data: { status: "failed", stage: "failed", errorMessage: "Processing was interrupted. Please retry." },
    });
  }
  const fresh = await prisma.project.findUnique({ where: { id }, select: { status: true, stage: true, progress: true, errorMessage: true, logs: true, duration: true } });
  return NextResponse.json({
    status: fresh?.status,
    stage: fresh?.stage,
    progress: fresh?.progress,
    errorMessage: fresh?.errorMessage,
    duration: fresh?.duration,
    metadata: project.metadata,
    logs: safeJson<LogLine[]>(fresh?.logs, []),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  cancelJob(id);
  return NextResponse.json({ ok: true });
}
