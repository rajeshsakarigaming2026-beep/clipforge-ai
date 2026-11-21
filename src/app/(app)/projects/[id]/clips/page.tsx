import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClipsClient from "@/components/clips-client";

export const dynamic = "force-dynamic";

export default async function ClipsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id }, include: { clips: { orderBy: { createdAt: "asc" } } } });
  if (!project) notFound();
  return <ClipsClient project={{ id: project.id, name: project.name, topic: project.topic }} clips={project.clips.map((c) => ({
    id: c.id, title: c.title, slug: c.slug, startTime: c.startTime, endTime: c.endTime, duration: c.duration,
    score: c.score, reason: c.reason, type: c.type, look: c.look, thumbPath: c.thumbPath,
    captionColor: c.captionColor, highlightColor: c.highlightColor, camX: c.camX, camY: c.camY,
    camW: c.camW, camH: c.camH, zoom: c.zoom, playbackSpeed: c.playbackSpeed,
  }))} />;
}
