import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectsClient } from "@/components/projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { clips: { select: { id: true } } },
  });
  return <ProjectsClient projects={projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />;
}
