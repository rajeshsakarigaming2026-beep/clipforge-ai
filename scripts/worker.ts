import { createServer } from "node:http";
import { prisma } from "../src/lib/db";
import { runProjectJob, runRenderJob } from "../src/server/jobs";

const active = new Set<string>();

const port = Number(process.env.PORT || 10000);
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, worker: true }));
}).listen(port, "0.0.0.0", () => console.log(`worker keep-awake server listening on ${port}`));

const keepAliveUrl = process.env.WORKER_URL;
if (keepAliveUrl) {
  const ping = () => void fetch(`${keepAliveUrl.replace(/\/$/, "")}/api/health`).catch(() => undefined);
  ping();
  setInterval(ping, 30000);
}

async function recover() {
  await prisma.project.updateMany({ where: { status: "processing", stage: { notIn: ["queued", "claiming", "local-queued", "local-processing"] } }, data: { stage: "queued" } });
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
      const projects = await prisma.project.findMany({ where: { status: "processing", stage: "claiming" }, select: { id: true, sourceType: true, sourceUrl: true } });
      for (const project of projects) {
        if (project.sourceType === "url" && /youtube\.com|youtu\.be/i.test(project.sourceUrl || "")) {
          await prisma.project.update({ where: { id: project.id }, data: { stage: "queued" } });
          continue;
        }
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
