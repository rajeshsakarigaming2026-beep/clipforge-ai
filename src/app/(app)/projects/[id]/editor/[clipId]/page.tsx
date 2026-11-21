import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import EditorClient from "@/components/editor-client";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string; clipId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id, clipId } = await params;
  const clip = await prisma.clip.findFirst({ where: { id: clipId, project: { id, userId: user.id } } });
  if (!clip) notFound();
  return <EditorClient projectId={id} clip={{
    id: clip.id, title: clip.title, startTime: clip.startTime, endTime: clip.endTime,
    duration: clip.duration, transcript: clip.transcript, captionColor: clip.captionColor,
    highlightColor: clip.highlightColor, camX: clip.camX, camY: clip.camY, camW: clip.camW,
    camH: clip.camH, zoom: clip.zoom, playbackSpeed: clip.playbackSpeed, look: clip.look,
    filePath: clip.filePath,
  }} />;
}
