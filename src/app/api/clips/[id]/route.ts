import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clipEditSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = clipEditSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid edit" }, { status: 400 });
  const clip = await prisma.clip.findFirst({ where: { id, project: { userId: user.id } } });
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  const updated = await prisma.clip.update({
    where: { id },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title, slug: parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) } : {}),
      ...(parsed.data.startTime !== undefined ? { startTime: parsed.data.startTime } : {}),
      ...(parsed.data.endTime !== undefined ? { endTime: parsed.data.endTime } : {}),
      ...(parsed.data.captionColor ? { captionColor: parsed.data.captionColor } : {}),
      ...(parsed.data.highlightColor ? { highlightColor: parsed.data.highlightColor } : {}),
      ...(parsed.data.camX !== undefined ? { camX: parsed.data.camX } : {}),
      ...(parsed.data.camY !== undefined ? { camY: parsed.data.camY } : {}),
      ...(parsed.data.camW !== undefined ? { camW: parsed.data.camW } : {}),
      ...(parsed.data.camH !== undefined ? { camH: parsed.data.camH } : {}),
      ...(parsed.data.zoom !== undefined ? { zoom: parsed.data.zoom } : {}),
      ...(parsed.data.playbackSpeed !== undefined ? { playbackSpeed: parsed.data.playbackSpeed } : {}),
      ...(parsed.data.layout ? { look: parsed.data.layout } : {}),
    },
  });
  return NextResponse.json({ clip: updated });
}
