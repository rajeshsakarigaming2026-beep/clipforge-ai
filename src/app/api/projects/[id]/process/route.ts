import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSupportedUrl } from "@/lib/utils";
import { startJob, wakeWorker } from "@/server/jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.sourceType === "url" && (!project.sourceUrl || !isSupportedUrl(project.sourceUrl))) {
    return NextResponse.json({ error: "Enter a supported video URL before processing." }, { status: 400 });
  }
  if (project.sourceType === "upload" && !project.storagePath) {
    return NextResponse.json({ error: "Upload a video before processing." }, { status: 400 });
  }
  if (project.status === "processing") return NextResponse.json({ ok: true, alreadyRunning: true });
  await prisma.clip.deleteMany({ where: { projectId: id } });
  if (process.env.CLOUD_WORKER === "true") {
    await prisma.project.update({
      where: { id },
      data: { status: "processing", stage: "queued", progress: 0, errorMessage: null },
    });
    wakeWorker();
  } else {
    startJob(id);
  }
  return NextResponse.json({ ok: true });
}
