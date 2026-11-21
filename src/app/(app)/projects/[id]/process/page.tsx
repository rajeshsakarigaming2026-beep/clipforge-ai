import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProcessClient from "@/components/process-client";

export const dynamic = "force-dynamic";

export default async function ProcessPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) notFound();
  return <ProcessClient project={{
    id: project.id, name: project.name, topic: project.topic, status: project.status,
    stage: project.stage, progress: project.progress, errorMessage: project.errorMessage,
    logs: project.logs, metadata: project.metadata, duration: project.duration,
  }} />;
}
