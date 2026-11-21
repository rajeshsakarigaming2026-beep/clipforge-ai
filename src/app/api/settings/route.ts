import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ settings: null });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const data: Record<string, string | number | boolean> = {};
  if (typeof body.captionColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.captionColor)) data.captionColor = body.captionColor;
  if (typeof body.highlightColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.highlightColor)) data.highlightColor = body.highlightColor;
  if (typeof body.fontFamily === "string") data.fontFamily = body.fontFamily.slice(0, 60);
  if (["auto", "stack", "crop", "blur"].includes(body.layout)) data.layout = body.layout;
  if (Number.isInteger(body.clipsPerVideo) && body.clipsPerVideo >= 3 && body.clipsPerVideo <= 6) data.clipsPerVideo = body.clipsPerVideo;
  if (typeof body.language === "string") data.language = body.language.slice(0, 20);
  if (typeof body.autoMusic === "boolean") data.autoMusic = body.autoMusic;
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json({ settings });
}
