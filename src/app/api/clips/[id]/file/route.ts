import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import fs from "node:fs/promises";
import path from "node:path";

type Params = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function GET(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const clip = await prisma.clip.findFirst({
    where: { id, project: { userId: user.id } },
    include: { project: { select: { name: true } } },
  });
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "thumb" ? "thumb" : "video";
  const rel = kind === "thumb" ? clip.thumbPath : clip.filePath;
  if (!rel) return NextResponse.json({ error: "File not available" }, { status: 404 });
  let data: Buffer;
  try {
    data = await storage.read(rel);
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
  const contentType = kind === "thumb" ? "image/jpeg" : "video/mp4";
  const range = request.headers.get("range");
  const inline = url.searchParams.get("inline") === "1";
  const filename = `${clip.slug || "clip"}${kind === "thumb" ? ".jpg" : ".mp4"}`;
  if (kind === "video" && range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (start >= 0 && end >= start && start < data.length) {
        return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${data.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(end - start + 1),
            ...(inline ? {} : { "Content-Disposition": `attachment; filename="${filename}"` }),
          },
        });
      }
    }
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Accept-Ranges": "bytes",
      ...(kind === "video" && !inline ? { "Content-Disposition": `attachment; filename="${filename}"` } : { "Cache-Control": "public, max-age=3600" }),
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const clip = await prisma.clip.findFirst({ where: { id, project: { userId: user.id } } });
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  await prisma.clip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
