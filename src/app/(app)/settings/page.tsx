import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SettingsClient from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPageRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <SettingsClient user={{ name: user.name, email: user.email }} />;
}
