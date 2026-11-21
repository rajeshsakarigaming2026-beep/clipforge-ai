import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { parseSite } from "@/lib/site";
import { AdminClient } from "@/components/admin-client";
import { Logo } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#05060d] p-6 text-center"><div><Logo /><p className="mt-6 text-slate-300">Sign in to open the admin panel.</p><Link href="/login" className="btn-primary mt-6 inline-flex">Sign in</Link></div></div>;
  if (!isAdmin(user.email)) return <div className="grid min-h-screen place-items-center bg-[#05060d] p-6 text-center"><div><Logo /><p className="mt-6 text-lg font-semibold text-white">Admin access required</p><p className="mt-2 text-sm text-slate-400">{user.email} is not in ADMIN_EMAILS.</p><Link href="/dashboard" className="btn-secondary mt-6 inline-flex">Back to dashboard</Link></div></div>;

  const [siteRow, requests, users, grants] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: "site" } }),
    prisma.purchaseRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).then((rows) => rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, settings: { select: { plan: true, paid: true, accessExpiresAt: true, clipsPerVideo: true } } } }).then((rows) => rows.map((row) => ({ ...row, accessExpiresAt: row.settings?.accessExpiresAt?.toISOString() || null, settings: row.settings ? { ...row.settings, accessExpiresAt: row.settings.accessExpiresAt?.toISOString() || null } : null }))),
    prisma.emailAccess.findMany({ orderBy: { createdAt: "desc" }, take: 100 }).then((rows) => rows.map((row) => ({ ...row, accessExpiresAt: row.accessExpiresAt?.toISOString() || null, createdAt: row.createdAt.toISOString() }))),
  ]);

  return (
    <div className="min-h-screen bg-[#05060d] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Admin</p><h1 className="mt-2 text-3xl font-bold">Workspace control panel</h1><p className="mt-1 text-sm text-slate-400">Edit the public site and review purchase enquiries. Signed in as {user.email}</p></div>
          <Link href="/" className="btn-secondary">View website</Link>
        </div>
        <AdminClient initialSite={parseSite(siteRow?.data)} initialRequests={requests} initialUsers={users} initialGrants={grants} />
      </div>
    </div>
  );
}
