import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = await prisma.renderJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const clip = await prisma.clip.findFirst({ where: { id: job.clipId, project: { userId: user.id } }, select: { id: true } });
  if (!clip) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ status: job.status, error: job.error });
}
