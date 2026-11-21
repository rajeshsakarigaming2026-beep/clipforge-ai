import { prisma } from "../src/lib/db";
import { runProjectJob, runRenderJob } from "../src/server/jobs";

const active = new Set<string>();

async function recover() {
  await prisma.project.updateMany({ where: { status: "processing", stage: { notIn: ["queued", "claiming"] } }, data: { stage: "queued" } });
  await prisma.project.updateMany({ where: { stage: "claiming" }, data: { stage: "queued" } });
  await prisma.renderJob.updateMany({ where: { status: "running" }, data: { status: "pending" } });
}

async function tick() {
  try {
    const claimed = await prisma.project.updateMany({
      where: { status: "processing", stage: "queued" },
      data: { stage: "claiming" },
    });
    if (claimed.count) {
      const projects = await prisma.project.findMany({ where: { status: "processing", stage: "claiming" }, select: { id: true } });
      for (const project of projects) {
        if (active.has(project.id)) continue;
        active.add(project.id);
        void runProjectJob(project.id).finally(() => active.delete(project.id));
      }
    }

    await prisma.renderJob.updateMany({ where: { status: "pending" }, data: { status: "running" } });
    const renderJobs = await prisma.renderJob.findMany({ where: { status: "running" }, select: { id: true } });
    for (const job of renderJobs) {
      if (active.has(job.id)) continue;
      active.add(job.id);
      void runRenderJob(job.id).finally(() => active.delete(job.id));
    }
  } catch (error) {
    console.error("worker tick failed", error);
  }
}

void recover()
  .catch((error) => console.error("worker recovery failed", error))
  .then(() => {
    void tick();
    setInterval(() => void tick(), 3000);
  });
