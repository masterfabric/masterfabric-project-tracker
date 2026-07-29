"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--text-muted)]">
        <span className="mf-pulse text-sm tracking-wide">Loading workspace…</span>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
