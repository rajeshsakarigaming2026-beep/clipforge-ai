import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clipEditSchema } from "@/lib/validation";
import { rerenderClip } from "@/server/jobs";

type Params = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NEXT_PUBLIC_HOSTED_MODE === "true") return NextResponse.json({ error: "Video processing is not available in this hosted website/admin deployment." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = clipEditSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid edit" }, { status: 400 });
  const clip = await prisma.clip.findFirst({ where: { id, project: { userId: user.id } } });
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  if (process.env.CLOUD_WORKER === "true") {
    const job = await prisma.renderJob.upsert({
      where: { clipId: id },
      create: { clipId: id, payload: JSON.stringify(parsed.data) },
      update: { payload: JSON.stringify(parsed.data), status: "pending", error: null },
    });
    return NextResponse.json({ ok: true, queued: true, jobId: job.id });
  }
  try {
    const file = await rerenderClip(clip.projectId, clip, parsed.data);
    const updated = await prisma.clip.findUnique({ where: { id }, select: { filePath: true, thumbPath: true, title: true } });
    return NextResponse.json({ ok: true, file, clip: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render failed" }, { status: 500 });
  }
}
