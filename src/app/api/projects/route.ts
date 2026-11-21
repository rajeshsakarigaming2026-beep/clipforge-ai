import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPaidAccess } from "@/lib/access";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clips: true } } },
  });
  const clips = await prisma.clip.count({ where: { project: { userId: user.id } } });
  return NextResponse.json({ projects, stats: { projects: projects.length, clips, processing: projects.filter((p) => p.status === "processing").length } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NEXT_PUBLIC_HOSTED_MODE === "true") {
    return NextResponse.json({ error: "Video processing is not available in this hosted website/admin deployment. Keep the local app running for rendering." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "Untitled project").slice(0, 100);
  const topic = String(body.topic || "general").slice(0, 80);
  const sourceType = body.sourceType === "url" ? "url" : "upload";
  const [settings, projectCount] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id } }),
  ]);
  if (!hasPaidAccess(settings) && projectCount >= 2) {
    return NextResponse.json({ error: "Free plan allows 2 projects. After purchase, ask the admin to activate your account, then try again." }, { status: 402 });
  }
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      topic,
      sourceType,
      sourceUrl: sourceType === "url" ? String(body.sourceUrl || "").slice(0, 2000) : null,
      fileName: body.fileName ? String(body.fileName).slice(0, 255) : null,
      status: "created",
      logs: JSON.stringify([]),
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}
