import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

async function LoginPageContent({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const resolvedSearchParams = searchParams;
  const redirectTo = (await resolvedSearchParams).redirect || "/";

  return <LoginForm redirectTo={redirectTo} />;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}