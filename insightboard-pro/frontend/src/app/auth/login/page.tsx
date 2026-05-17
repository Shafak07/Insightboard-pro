import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
      <Skeleton className="h-[420px] w-full max-w-[400px] rounded-xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
