import { AuthForm } from "@/components/auth-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="signup" notice={params.error === "google" ? "Google sign-in is not configured yet. Ask the admin to add the Google client ID." : undefined} />;
}
