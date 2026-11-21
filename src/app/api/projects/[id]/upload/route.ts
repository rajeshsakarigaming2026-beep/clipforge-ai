import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No video file was uploaded" }, { status: 400 });
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 2048);
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `File is too large. Limit is ${maxMb} MB.` }, { status: 413 });
  }
  if (file.size < 1024) return NextResponse.json({ error: "The file appears to be empty" }, { status: 400 });
  const safeName = slugify(file.name.replace(/\.[^.]+$/, "")) + (file.name.match(/\.[^.]+$/) || [".mp4"])[0].toLowerCase();
  const rel = `projects/${id}/source/${Date.now()}-${safeName}`;
  await storage.write(rel, Buffer.from(await file.arrayBuffer()));
  await prisma.project.update({
    where: { id },
    data: { storagePath: rel, fileName: file.name, sourceType: "upload", status: "created", errorMessage: null },
  });
  return NextResponse.json({ ok: true, fileName: file.name, size: file.size });
}
