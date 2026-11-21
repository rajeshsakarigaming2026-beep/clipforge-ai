import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { buildZip } from "@/lib/zip";

type Params = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { clips: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const files = [];
  for (const [index, clip] of project.clips.entries()) {
    try {
      files.push({ name: `${String(index + 1).padStart(2, "0")}-${clip.slug}.mp4`, data: await storage.read(clip.filePath) });
    } catch { /* skip missing files */ }
  }
  if (!files.length) return NextResponse.json({ error: "No clips are ready to download" }, { status: 404 });
  const zip = buildZip(files);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.name.replace(/[^\w\- ]+/g, "_")}-clips.zip"`,
    },
  });
}
